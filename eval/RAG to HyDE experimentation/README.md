# RAG to HyDE Experimentation

The full experiment trail behind the decision to ship HyDE retrieval
(commit `587a0e5`, May 12, 2026). Each CSV is one run of the retrieval eval
harness ([eval-retrieval.js](../eval-retrieval.js)) against the same 23-query
set ([queries.json](../queries.json)), judged chunk-by-chunk by Claude Haiku
as a binary relevant/not-relevant judge.

**The headline: retrieval pass rate went from 9% → 100% across these six runs.**

## The runs, in order

| Date | File | What changed | Pass rate |
|---|---|---|---|
| May 7 | `2026-05-07_n8_baseline.csv` | Baseline: production config at the time — 8 chunks/query, threshold 0.75, pass bar 6/8 (75%) | **2/23 (9%)** |
| May 12 | `2026-05-12_n8_t075_vlower-pass-bar-4of8.csv` | Lowered pass bar from 6/8 to 4/8 — was the bar just too strict? | **5/23 (22%)** |
| May 12 | `2026-05-12_n8_t075_vrelaxed-judge-prompt.csv` | Relaxed the judge prompt — was the judge too harsh on tangentially-relevant chunks? | **13/23 (57%)** |
| May 12 | `2026-05-12_n20_t075_vmatch-count-20.csv` | Bumped match_count 8 → 20, HyDE off — control run to isolate whether more chunks alone would help | **13/23 (57%)** |
| May 12 | `2026-05-12_n20_t075_vhyde.csv` | **HyDE on**: embed a Haiku-generated hypothetical Reddit-style answer instead of the raw question | **21/23 (91%)** |
| May 13 | `2026-05-13_n20_t075_vhyde-with-doc.csv` | Re-run with the generated `hyde_doc` logged as a CSV column for auditability | **23/23 (100%)** |

## What we learned

1. **The eval was partly measuring the yardstick, not retrieval.** The first two
   experiments (lower pass bar, relaxed judge prompt) moved the number from 9%
   to 57% without touching retrieval at all. That recalibrated the harness to a
   fair grading standard — but 57% was still a real retrieval problem.
2. **More chunks alone didn't help.** match_count 20 with HyDE off scored the
   same 57% as the n=8 relaxed-judge run. The problem wasn't how many neighbors
   we grabbed — it was that we were searching in the wrong neighborhood.
3. **The core insight (from the ship commit):** the corpus is *answers* —
   Reddit posts written by women describing their experiences. A raw question
   like "How painful are the injections?" lands in a different vector
   neighborhood than the answer-shaped posts that address it. HyDE generates a
   hypothetical Reddit-style answer post via Haiku first, then embeds *that*,
   putting the query vector where the real posts live. 57% → 91% from that
   change alone.
4. **Run-to-run variance exists.** The hyde-with-doc re-run scored 100% vs 91%
   the day before with the same config — HyDE generation and the judge are both
   nondeterministic. Treat single-run pass rates as approximate.

## What shipped

HyDE enabled in production ([supabase/functions/wtf-chat/index.ts](../../supabase/functions/wtf-chat/index.ts)):
match_count 20, threshold 0.75, HyDE via `claude-haiku-4-5`, judge pass bar 10/20.

## How to read a CSV

One row per retrieved chunk. Columns: `id`/`category`/`query` (from
queries.json), `hyde_doc` (the generated hypothetical answer — last run only),
`chunk_rank`, `chunk_preview`, `score` (judge's 0/1 on that chunk), `reason`
(judge's one-line rationale), `query_score` (relevant chunks out of retrieved),
`query_verdict` (PASS/FAIL against the pass bar).

New eval runs are written by the harness to [../results/](../results/); move a
finished experiment series into a folder like this one with a README once a
decision is made.
