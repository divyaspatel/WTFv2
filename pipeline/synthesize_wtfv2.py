"""
synthesize_wtfv2.py — generate milestone accordion content from Reddit posts.

For each of the 10 egg/embryo freezing milestones:
  1. Embed a milestone-specific query
  2. Retrieve the top 20 most relevant post chunks from Supabase
  3. Ask Claude to extract three content types:
       - questions_to_ask  (list of questions women wish they'd asked their RE)
       - wisdom            (insights and things women wish they'd known)
       - resources         (topic areas and references worth knowing about)
  4. Upsert to the milestone_insights table in Supabase

Run after embed.py:
    python3 synthesize_wtfv2.py

Safe to re-run — upserts overwrite existing rows.

Requires .env with:
    OPENAI_API_KEY
    ANTHROPIC_API_KEY
    SUPABASE_URL
    SUPABASE_SERVICE_KEY

Supabase table schema (create once):
    create table milestone_insights (
        id           text primary key,     -- milestone slug, e.g. 'initial_testing'
        phase        text not null,        -- display name shown in UI
        questions    jsonb,               -- array of question strings
        wisdom       jsonb,               -- array of {quote, source_count}
        resources    jsonb,               -- array of {title, description}
        updated_at   timestamptz default now()
    );
"""

import json
import os
import time
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI
import anthropic
from supabase import create_client

load_dotenv(Path(__file__).parent / ".env")

openai_client  = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
claude_client  = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
supabase       = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

EMBED_MODEL      = "text-embedding-ada-002"
CLAUDE_MODEL     = "claude-haiku-4-5"
MATCH_COUNT      = 40
MATCH_THRESHOLD  = 0.65


# ── Milestones ────────────────────────────────────────────────────────────────
# Each query is written to surface the most relevant Reddit posts for that phase.
# The UI labels and slugs must match what app.js renders.

MILESTONES = [
    {
        "id":    "initial_testing",
        "phase": "Initial Fertility Testing",
        "note":  None,
        "query": (
            "AMH AFC antral follicle count baseline bloodwork FSH LH estradiol "
            "fertility testing first blood test results what my numbers mean "
            "ovarian reserve low AMH good AMH"
        ),
    },
    {
        "id":    "re_consult",
        "phase": "Reproductive Endocrinologist Consultation",
        "note":  None,
        "query": (
            "reproductive endocrinologist RE consultation first appointment "
            "choosing a fertility clinic questions to ask doctor consultation "
            "what to expect first visit comparing clinics success rates"
        ),
    },
    {
        "id":    "stim_start",
        "phase": "Stimulation Protocol Start",
        "note":  None,
        "query": (
            "starting stimulation injections first injection day 1 stims protocol "
            "gonal-f menopur cetrotide antagonist protocol lupron flare "
            "how to inject self-inject pen needle fear anxiety starting meds"
        ),
    },
    {
        "id":    "monitoring",
        "phase": "Monitoring and Adjustments",
        "note":  None,
        "query": (
            "monitoring appointments ultrasound bloodwork estradiol levels rising "
            "follicle growth sizes adjusting medication dose stimulation "
            "how many follicles slow response high responder OHSS risk "
            "mid cycle check in results"
        ),
    },
    {
        "id":    "trigger_retrieval",
        "phase": "Trigger Shot & Egg Retrieval",
        "note":  None,
        "query": (
            "trigger shot timing ovidrel lupron trigger HCG retrieval day "
            "procedure sedation anesthesia recovery after retrieval "
            "how many eggs retrieved mature eggs MII numbers results "
            "retrieval day experience what to expect"
        ),
    },
    {
        "id":    "eggs_frozen",
        "phase": "Eggs Are Frozen",
        "note":  (
            "This is the end of the journey for women who choose to freeze eggs. "
            "Women who choose to freeze embryos continue with the following steps."
        ),
        "query": (
            "eggs frozen results how many mature eggs vitrification storage "
            "egg freezing done cycle complete how many eggs is enough "
            "deciding to do another cycle storage costs long term"
        ),
    },
    {
        "id":    "fertilization",
        "phase": "Embryo Making: Conventional IVF or ICSI Fertilization?",
        "note":  None,
        "query": (
            "fertilization IVF ICSI intracytoplasmic sperm injection conventional IVF "
            "which fertilization method choosing ICSI vs IVF sperm quality "
            "fertilization rate how many eggs fertilized embryo making decision"
        ),
    },
    {
        "id":    "embryo_development",
        "phase": "Embryo Development",
        "note":  None,
        "query": (
            "embryo development blastocyst day 3 day 5 fertilization rate "
            "embryo grading quality blast AA AB morula arrested embryos "
            "waiting for day 5 results how many made it to blast "
            "attrition rates normal"
        ),
    },
    {
        "id":    "pgta",
        "phase": "PGT-A Genetic Testing",
        "note":  None,
        "query": (
            "PGT-A preimplantation genetic testing results normal euploid "
            "abnormal aneuploid mosaic embryo PGT results what they mean "
            "worth the cost of PGT all embryos abnormal biopsy day 5 "
            "should I do PGT genetic testing decision"
        ),
    },
    {
        "id":    "embryos_frozen",
        "phase": "Embryos Are Frozen",
        "note":  None,
        "query": (
            "embryos frozen storage how many embryos enough frozen embryo transfer "
            "FET next steps storage fees annual cost clinic transfer moving embryos "
            "when to transfer how long to wait"
        ),
    },
]


# ── Prompts ───────────────────────────────────────────────────────────────────

SYNTHESIS_PROMPT = """\
You are reading real Reddit posts from r/IVF, r/eggfreezing, and r/fertility \
about a specific phase of the egg or embryo freezing process.

Phase: {phase}

Here are {count} relevant excerpts from real community posts:

{posts}

Extract three types of content from what these women actually wrote. \
Stay grounded in the posts — do not add information that isn't in the text.

Return a JSON object with exactly these three keys:

"questions_to_ask": A list of 6–10 questions women at this phase wish they \
had asked their doctor or clinic. Write each as a direct question, like \
"What does my AMH level actually mean for my cycle?" Draw these from \
questions, confusions, and regrets the community expressed.

"wisdom": A list of 4–6 insights — things women said they wish they'd known, \
surprises, or patterns that came up repeatedly. Each item is an object with:
  "quote"        — a short distilled insight in the community's own voice \
(1–2 sentences, written as if a woman is sharing it with a friend)
  "source_count" — an integer: how many of the {count} posts informed this insight

"resources": A list of 3–5 topic areas or references that women in these posts \
mentioned researching, asking about, or wishing they'd known about sooner. \
Each item is an object with:
  "title"       — short descriptive name (e.g. "Understanding AMH ranges by age")
  "description" — one sentence on what it covers and why it matters at this phase

Return ONLY the JSON object. No prose, no markdown fences.\
"""


# ── Pipeline ──────────────────────────────────────────────────────────────────

def embed_query(text: str) -> list[float]:
    resp = openai_client.embeddings.create(model=EMBED_MODEL, input=[text])
    return resp.data[0].embedding


def fetch_relevant_posts(milestone: dict) -> list[dict]:
    embedding = embed_query(milestone["query"])
    result = supabase.rpc("match_posts", {
        "query_embedding":  embedding,
        "match_threshold":  MATCH_THRESHOLD,
        "match_count":      MATCH_COUNT,
        "stage_filter":     None,   # None = search all stages
    }).execute()
    return result.data or []


def synthesize(milestone: dict, posts: list[dict]) -> dict:
    post_text = "\n\n---\n\n".join(
        f"[r/{p['subreddit']}] {p.get('title', '')}\n{p.get('chunk_text') or p.get('content', '')}"
        for p in posts
    )

    prompt = SYNTHESIS_PROMPT.format(
        phase=milestone["phase"],
        count=len(posts),
        posts=post_text,
    )

    message = claude_client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


def run():
    print("Generating milestone insights for WTFv2...\n")

    for milestone in MILESTONES:
        print(f"  {milestone['phase']}...")

        posts = fetch_relevant_posts(milestone)
        if not posts:
            print(f"    No posts found — skipping.")
            continue

        print(f"    {len(posts)} posts retrieved")

        if len(posts) < 3:
            print(f"    Too few posts to synthesize — skipping.")
            continue

        content = synthesize(milestone, posts)

        row = {
            "id":        milestone["id"],
            "phase":     milestone["phase"],
            "note":      milestone["note"],
            "questions": content.get("questions_to_ask", []),
            "wisdom":    content.get("wisdom", []),
            "resources": content.get("resources", []),
        }

        supabase.table("milestone_insights").upsert(
            row, on_conflict="id"
        ).execute()

        q_count = len(row["questions"])
        w_count = len(row["wisdom"])
        r_count = len(row["resources"])
        print(f"    Saved: {q_count} questions, {w_count} wisdom, {r_count} resources\n")

        time.sleep(1)

    print("Done. All milestone insights saved to Supabase.")
    print("Wire the milestone_insights table to the UI in app.js to replace stub content.")


if __name__ == "__main__":
    run()
