# Data Pipeline

Three-stage pipeline that builds the RAG corpus behind the WTF chatbot and the
milestone accordion content. This is the source of the "10,000+ real
conversations" the app cites.

## Stages (run in order)

| Stage | Script | What it does |
|---|---|---|
| 1. Scrape | [scraper.py](scraper.py) | Pulls posts + comments from 7 fertility subreddits (r/IVF, r/eggfreezing, r/fertility, r/infertility, r/ttc, r/PCOS, r/SingleMothersbyChoice) across 5 sort orders each to beat Reddit's ~1,000-post listing cap. Dedupes by post ID. Writes `posts.json` (~10k posts). |
| 2. Embed | [embed.py](embed.py) | Chunks posts + comments, embeds with `text-embedding-ada-002`, upserts to the Supabase `posts` table. Idempotent — safe to re-run. |
| 3. Synthesize | [synthesize_wtfv2.py](synthesize_wtfv2.py) | For each of 10 egg-freezing milestones: retrieves top 20 chunks, has Claude extract questions-to-ask / wisdom / resources, upserts to `milestone_insights`. |

```bash
pip install -r requirements.txt
python3 scraper.py && python3 embed.py && python3 synthesize_wtfv2.py
```

## Must run locally

The scraper **cannot run from GitHub Actions or any cloud host** — Reddit
blocks data-center IPs. Run all three stages from a residential machine.

## Not in git (see root .gitignore)

- `.env` — API keys. Copy [.env.example](.env.example) and fill in
  `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`.
- `posts.json` — 71MB of scraped raw data. Regenerable by re-running the
  scraper; the embedded version persists in Supabase, so losing this file
  loses nothing the app depends on.
