"""
embed.py — chunk posts + comments, generate embeddings, upsert to Supabase.

Run after scraper.py:
    python3 embed.py

Idempotent — skips posts already in the DB. Safe to re-run.

Requires .env with:
    OPENAI_API_KEY
    SUPABASE_URL
    SUPABASE_SERVICE_KEY

━━━ ROW ID SCHEME ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Post body chunks:  {post_id}_{chunk_index}        e.g. abc123_0, abc123_1
  Comment chunks:    {post_id}_c{comment_index}_{chunk_index}  e.g. abc123_c4_0

  The idempotency check looks for {post_id}_0. If that row exists, the entire
  post (body + all comments) is assumed to be embedded already and is skipped.

━━━ WHAT GETS EMBEDDED ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  For each post:
    1. title + body  → chunked at 500 words with 50-word overlap
    2. each comment  → chunked at 500 words with 50-word overlap
                       stored as separate rows with source_type = 'comment'

  Both post chunks and comment chunks land in the same `posts` table and are
  retrieved together by match_posts. source_type lets you filter or weight
  them differently in future.
"""

import json
import os
import time
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client

load_dotenv(Path(__file__).parent / ".env")

openai_client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
supabase      = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

CHUNK_SIZE    = 500   # words per chunk
CHUNK_OVERLAP = 50    # word overlap between chunks to preserve context at boundaries
BATCH_SIZE    = 100   # rows per OpenAI embed call
MODEL         = "text-embedding-ada-002"   # 1536 dims — matches posts table vector column

POSTS_FILE = Path(__file__).parent / "posts.json"


def chunk_text(text: str) -> list[str]:
    """Split text into overlapping 500-word windows. Short texts return as-is."""
    words = text.split()
    if len(words) <= CHUNK_SIZE:
        return [text]
    chunks = []
    start = 0
    while start < len(words):
        end = start + CHUNK_SIZE
        chunks.append(" ".join(words[start:end]))
        start += CHUNK_SIZE - CHUNK_OVERLAP
    return chunks


def embed_batch(texts: list[str]) -> list[list[float]]:
    resp = openai_client.embeddings.create(model=MODEL, input=texts)
    return [item.embedding for item in resp.data]


def fetch_embedded_ids() -> set[str]:
    """
    Fetch all existing row IDs from Supabase in one bulk query.
    Used at startup to build a local set — avoids 9,000+ individual DB calls.
    Paginates through all rows since Supabase caps single responses at 1,000.
    """
    ids = set()
    offset = 0
    page_size = 1000
    while True:
        result = supabase.table("posts").select("id").range(offset, offset + page_size - 1).execute()
        if not result.data:
            break
        for row in result.data:
            ids.add(row["id"])
        if len(result.data) < page_size:
            break
        offset += page_size
    return ids


def build_rows(post: dict) -> list[dict]:
    """Return all rows (body chunks + comment chunks) for a single post."""
    rows = []
    base = {
        "subreddit":  post["subreddit"],
        "title":      post["title"],
        "url":        post["url"],
        "score":      post.get("score"),
        "created_at": post.get("created_at"),
        "scraped_at": post.get("scraped_at"),
        "stage":      post.get("stage"),   # null until classify.py is run
    }

    # ── Body chunks ──────────────────────────────────────────────────────────
    body_text = f"{post['title']}\n\n{post['text']}"
    for i, chunk in enumerate(chunk_text(body_text)):
        rows.append({
            **base,
            "id":          f"{post['id']}_{i}",
            "text":        post["text"],
            "chunk_index": i,
            "chunk_text":  chunk,
            "source_type": "post",
        })

    # ── Comment chunks ───────────────────────────────────────────────────────
    for ci, comment in enumerate(post.get("comments", [])):
        if not comment or not comment.strip():
            continue
        for chunk_i, chunk in enumerate(chunk_text(comment)):
            rows.append({
                **base,
                "id":          f"{post['id']}_c{ci}_{chunk_i}",
                "text":        comment,   # full comment text for context
                "chunk_index": chunk_i,
                "chunk_text":  chunk,
                "source_type": "comment",
            })

    return rows


def run():
    with open(POSTS_FILE) as f:
        posts = json.load(f)

    print(f"Loaded {len(posts)} posts from {POSTS_FILE.name}")

    print("Fetching already-embedded IDs from Supabase...")
    embedded_ids = fetch_embedded_ids()
    print(f"  {len(embedded_ids)} rows already in DB")

    rows_to_upsert = []
    skipped_posts = 0

    for post in posts:
        all_rows = build_rows(post)
        # Filter out individual rows already in DB — handles partial crashes
        # (e.g. body embedded but comments not yet)
        new_rows = [r for r in all_rows if r["id"] not in embedded_ids]
        if not new_rows:
            skipped_posts += 1
            continue
        rows_to_upsert.extend(new_rows)

    total_comments = sum(len(p.get("comments", [])) for p in posts)
    print(f"Skipping {skipped_posts} fully-embedded posts")
    print(f"Embedding {len(rows_to_upsert)} new chunks ({len(posts) - skipped_posts} posts have new content)...")

    if not rows_to_upsert:
        print("Nothing to do.")
        return

    for batch_start in range(0, len(rows_to_upsert), BATCH_SIZE):
        batch = rows_to_upsert[batch_start:batch_start + BATCH_SIZE]
        texts = [r["chunk_text"] for r in batch]
        embeddings = embed_batch(texts)

        records = []
        for row, embedding in zip(batch, embeddings):
            records.append({**row, "embedding": embedding})

        supabase.table("posts").upsert(records).execute()

        done = min(batch_start + BATCH_SIZE, len(rows_to_upsert))
        if done % 1000 == 0 or done == len(rows_to_upsert):
            print(f"  {done}/{len(rows_to_upsert)} chunks embedded & saved")
        time.sleep(0.5)

    print("\nDone. Next: run synthesize_wtfv2.py")


if __name__ == "__main__":
    run()
