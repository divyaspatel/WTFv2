"""
scraper.py — scrape Reddit posts + comments relevant to egg/embryo freezing.

MUST RUN LOCALLY — Reddit blocks data center IPs (GitHub Actions, AWS, etc.).
Output: posts.json in this directory.

━━━ SUBREDDITS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  All subreddits are already topically focused, so every post with a body ≥ 50
  characters is included — no keyword filter applied. This recovers short but
  signal-rich posts (e.g. "Had retrieval today — 12 eggs, 9 mature. So relieved.")
  that the old keyword filter would have dropped.

  r/IVF                  — broad IVF community; covers stimulation through embryo transfer
  r/eggfreezing          — egg freezing specific; richest source for freeze-only journeys
  r/fertility            — general fertility; good for early-stage testing and consult posts
  r/infertility          — large, active community; covers the full journey end-to-end
  r/ttc                  — trying to conceive; captures early-stage decision-making
  r/PCOS                 — common underlying condition heavily discussed in fertility context
  r/SingleMothersbyChoice — solo freezers; underrepresented in the core subreddits

━━━ SORT ORDERS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Reddit's API hard-caps any single listing at ~1,000 posts regardless of how
  many pages you paginate through. To reach ~10,000 unique posts we scrape five
  sort orders per subreddit and deduplicate by post ID:

    new          — most recent posts; catches current threads
    hot          — trending now; overlaps with new but surfaces high-engagement posts
    top/month    — best posts of the last 30 days; avoids hot-post recency bias
    top/year     — best of the year; captures advice posts that aged well
    top/all      — all-time top posts; the evergreen "what I wish I'd known" content

  Expected unique posts per subreddit: 1,500–3,000 (after dedup).
  Expected total across 7 subreddits: 10,000–20,000.

━━━ COMMENT FETCHING ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  After collecting all unique posts for a subreddit, the scraper fetches the
  full comment thread for each post via:
    GET /r/{subreddit}/comments/{post_id}.json

  Comments are recursively flattened from Reddit's nested reply tree. Deleted,
  removed, and very short (<20 char) comments are dropped. Each post's comments
  are stored as "comments": ["...", "..."] in posts.json so downstream scripts
  (embed.py, classify.py) can treat them as additional text chunks alongside the
  post title and body.

  Rate limit: 1 second between comment fetches to stay within Reddit's informal
  limits. Estimated run time: 60–120 minutes for a full 10,000-post corpus.

━━━ RATE LIMITING & RETRIES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Reddit/Cloudflare throttles requests after sustained scraping — empty responses
  are the signal. curl_get retries up to MAX_RETRIES times with exponential
  backoff (RETRY_BASE_DELAY × 2^attempt seconds) before giving up on a page.
  DELAY_BETWEEN_SUBS is set high (15s) to let the connection cool between
  subreddits, which is where rate limiting most commonly kicks in.

━━━ PIPELINE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  After running this script:
    1. classify.py        → adds "stage" field to each post in posts.json
    2. embed.py           → chunks, embeds, upserts to Supabase posts table
    3. synthesize_wtfv2.py → generates milestone accordion content

━━━ CURL vs REQUESTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Uses system curl rather than Python requests to bypass TLS fingerprinting that
  Reddit/Cloudflare uses to block automated clients.
"""

import argparse
import json
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

SUBREDDITS = ["IVF", "eggfreezing", "fertility", "infertility", "ttc", "PCOS", "SingleMothersbyChoice"]

SORT_ORDERS = [
    ("new",  {}),           # most recent posts
    ("hot",  {}),           # trending; partial overlap with new
    ("top",  {"t": "month"}),  # best of last 30 days
    ("top",  {"t": "year"}),   # best of last 12 months
    ("top",  {"t": "all"}),    # all-time top; evergreen advice posts
]

KEYWORDS = [
    # Testing & baseline
    "AMH", "AFC", "antral follicle", "baseline bloodwork", "FSH", "estradiol baseline",
    "AMH low", "diminished ovarian reserve", "DOR", "ovarian reserve",
    # Clinic & consultation
    "reproductive endocrinologist", "RE consult", "fertility clinic", "choosing a clinic",
    "second opinion", "waitlist", "consultation cost",
    # Stimulation
    "egg freezing", "egg retrieval", "stimulation", "stims", "stimming",
    "follicle", "gonal", "menopur", "cetrotide", "letrozole", "clomid",
    "trigger shot", "ovidrel", "lupron trigger",
    # Monitoring
    "transvaginal ultrasound", "E2 levels", "estrogen levels", "monitoring appointment",
    # Retrieval & results
    "bloating", "injections", "monitoring", "retrieval day", "mature eggs", "MII",
    "egg count", "egg quality", "how many eggs",
    "anesthesia", "sedation", "retrieval recovery",
    # Embryo path
    "fertilization", "ICSI", "conventional IVF", "blastocyst", "embryo",
    "day 3", "day 5", "day 7", "blast", "fertilization rate",
    # Genetic testing
    "PGT-A", "PGT", "euploid", "aneuploid", "mosaic", "genetic testing",
    # Storage & next steps
    "frozen embryo", "FET", "embryo transfer", "storage", "frozen eggs",
    # Cost & insurance
    "cost", "insurance coverage", "financing", "IVF cost", "out of pocket",
    # Emotional & personal context
    "anxiety", "stress", "grief", "solo", "single mom by choice",
]

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

MAX_POSTS_PER_SORT  = 1000  # Reddit API hard cap — pagination stops working beyond this
DELAY_BETWEEN_PAGES = 2     # seconds between pagination requests within one sort order
DELAY_BETWEEN_SORTS = 5     # seconds between sort orders for the same subreddit
DELAY_BETWEEN_SUBS  = 15    # seconds between subreddits — longer to avoid rate limiting
DELAY_COMMENTS      = 1     # seconds between individual comment thread fetches

MAX_RETRIES      = 4        # max retry attempts per failed request
RETRY_BASE_DELAY = 5        # seconds; doubles each retry (5, 10, 20, 40)

MIN_POST_LENGTH = 50        # characters — low floor to keep short but signal-rich posts

OUTPUT_FILE = Path(__file__).parent / "posts.json"


def is_relevant(text: str) -> bool:
    tl = text.lower()
    return any(kw.lower() in tl for kw in KEYWORDS)


def curl_get(url: str, params: dict) -> dict:
    query = "&".join(f"{k}={v}" for k, v in params.items())
    full_url = f"{url}?{query}"

    for attempt in range(MAX_RETRIES):
        try:
            result = subprocess.run(
                ["curl", "-s", "-A", USER_AGENT, full_url],
                capture_output=True, text=True, timeout=30,
            )
        except subprocess.TimeoutExpired:
            wait = RETRY_BASE_DELAY * (2 ** attempt)
            print(f"    Curl timed out, retrying in {wait}s (attempt {attempt + 1}/{MAX_RETRIES})...")
            time.sleep(wait)
            continue

        if result.returncode != 0:
            raise RuntimeError(f"curl failed (exit {result.returncode}): {result.stderr.strip()}")

        body = result.stdout.strip()
        if body:
            return json.loads(body)

        # Empty response = rate limited — back off and retry
        wait = RETRY_BASE_DELAY * (2 ** attempt)
        print(f"    Empty response, retrying in {wait}s (attempt {attempt + 1}/{MAX_RETRIES})...")
        time.sleep(wait)

    raise RuntimeError("curl returned an empty response after all retries")


def flatten_comments(comment_tree: list, depth: int = 0) -> list[str]:
    """Recursively extract comment bodies from Reddit's nested comment tree."""
    texts = []
    for item in comment_tree:
        if not isinstance(item, dict):
            continue
        data = item.get("data", {})
        # "more" nodes are pagination stubs — skip them
        if item.get("kind") == "more":
            continue
        body = data.get("body", "")
        if body and body not in ("[deleted]", "[removed]") and len(body) >= 20:
            texts.append(body)
        replies = data.get("replies", {})
        if isinstance(replies, dict):
            children = replies.get("data", {}).get("children", [])
            texts.extend(flatten_comments(children, depth + 1))
    return texts


def fetch_comments(subreddit: str, post_id: str) -> list[str]:
    url = f"https://old.reddit.com/r/{subreddit}/comments/{post_id}.json"
    try:
        data = curl_get(url, {"raw_json": 1, "limit": 500})
        # Response is [post_listing, comment_listing]
        if not isinstance(data, list) or len(data) < 2:
            return []
        comment_listing = data[1].get("data", {}).get("children", [])
        return flatten_comments(comment_listing)
    except (RuntimeError, json.JSONDecodeError, KeyError, subprocess.TimeoutExpired):
        return []


def fetch_posts_for_sort(subreddit: str, sort: str, sort_params: dict) -> dict[str, dict]:
    """Returns a dict of post_id → post dict for one sort order."""
    posts: dict[str, dict] = {}
    after: str | None = None
    base_url = f"https://old.reddit.com/r/{subreddit}/{sort}.json"

    while len(posts) < MAX_POSTS_PER_SORT:
        params: dict = {"limit": 100, "raw_json": 1, **sort_params}
        if after:
            params["after"] = after

        try:
            data = curl_get(base_url, params)
        except (RuntimeError, json.JSONDecodeError) as exc:
            print(f"    Error ({sort}): {exc}")
            break

        children = data.get("data", {}).get("children", [])
        if not children:
            break

        for child in children:
            p        = child.get("data", {})
            post_id  = p.get("id")
            title    = p.get("title", "")
            selftext = p.get("selftext", "")

            if not post_id or post_id in posts:
                continue
            # No keyword filter — subreddits are already topically focused
            if len(selftext) < MIN_POST_LENGTH:
                continue

            posts[post_id] = {
                "id":         post_id,
                "subreddit":  subreddit,
                "title":      title,
                "text":       selftext,
                "comments":   [],   # populated later
                "url":        f"https://reddit.com{p.get('permalink', '')}",
                "score":      p.get("score"),
                "created_at": datetime.fromtimestamp(
                                  p.get("created_utc", 0), tz=timezone.utc
                              ).isoformat(),
                "scraped_at": datetime.now(tz=timezone.utc).isoformat(),
                "stage":      None,
            }

        after = data.get("data", {}).get("after")
        if not after:
            break

        time.sleep(DELAY_BETWEEN_PAGES)

    return posts


def scrape(subreddits: list[str]):
    # Load existing posts.json so we can merge without losing previous work
    all_posts: dict[str, dict] = {}
    if OUTPUT_FILE.exists():
        with open(OUTPUT_FILE) as f:
            existing = json.load(f)
        all_posts = {p["id"]: p for p in existing}
        print(f"Loaded {len(all_posts)} existing posts from {OUTPUT_FILE}")

    for subreddit in subreddits:
        print(f"\nScraping r/{subreddit}...")
        sub_posts: dict[str, dict] = {}

        for sort, sort_params in SORT_ORDERS:
            label = f"{sort}/{sort_params.get('t', '')}" if sort_params else sort
            print(f"  [{label}] fetching...")
            fetched = fetch_posts_for_sort(subreddit, sort, sort_params)
            new = {pid: p for pid, p in fetched.items() if pid not in sub_posts}
            sub_posts.update(new)
            print(f"  [{label}] +{len(new)} new posts (sub total: {len(sub_posts)})")
            time.sleep(DELAY_BETWEEN_SORTS)

        # Fetch comments for each unique post in this subreddit
        print(f"  Fetching comments for {len(sub_posts)} posts...")
        for i, (post_id, post) in enumerate(sub_posts.items(), 1):
            post["comments"] = fetch_comments(subreddit, post_id)
            if i % 50 == 0:
                print(f"    {i}/{len(sub_posts)} comment threads fetched")
                # Save every 50 comments so a crash loses at most 50 posts of work
                checkpoint = list({**all_posts, **sub_posts}.values())
                with open(OUTPUT_FILE, "w") as f:
                    json.dump(checkpoint, f, indent=2)
            time.sleep(DELAY_COMMENTS)

        # Merge into global dedup dict
        new_global = {pid: p for pid, p in sub_posts.items() if pid not in all_posts}
        all_posts.update(new_global)
        print(f"  r/{subreddit} done — {len(sub_posts)} posts, {len(new_global)} new globally")

        # Save after each subreddit so a crash doesn't lose completed work
        posts_list = list(all_posts.values())
        with open(OUTPUT_FILE, "w") as f:
            json.dump(posts_list, f, indent=2)
        print(f"  Checkpoint saved — {len(posts_list)} total posts in {OUTPUT_FILE.name}")

        time.sleep(DELAY_BETWEEN_SUBS)

    posts_list = list(all_posts.values())

    with open(OUTPUT_FILE, "w") as f:
        json.dump(posts_list, f, indent=2)

    total_comments = sum(len(p["comments"]) for p in posts_list)
    print(f"\nDone. {len(posts_list)} posts, {total_comments} comments → {OUTPUT_FILE}")
    print("Next: run classify.py")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape Reddit posts for WTFv2 corpus.")
    parser.add_argument(
        "--subreddits", nargs="+", default=SUBREDDITS,
        help="Subreddits to scrape (default: all). Merges with existing posts.json.",
    )
    args = parser.parse_args()
    scrape(args.subreddits)
