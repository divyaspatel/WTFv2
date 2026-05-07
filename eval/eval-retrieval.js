/**
 * WTF Retrieval Eval — Layer 1
 *
 * Runs each query in queries.json against match_posts (production params),
 * then uses Claude Haiku as a binary judge on each returned chunk.
 *
 * Pass bar: PASS_BAR/MATCH_COUNT chunks must score 1 for a query to PASS.
 *
 * Usage:
 *   npm run eval
 *
 * Output:
 *   eval/results/YYYY-MM-DD_n<count>.csv
 *
 * Required in .env:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from project root (one level up from eval/), regardless of cwd
config({ path: path.resolve(__dirname, '..', '.env') });

// ── Config ────────────────────────────────────────────────────────────────────
// Match production values from supabase/functions/wtf-chat/index.ts exactly.
// Change these to test a different configuration, then compare CSV outputs.
const MATCH_COUNT = 8;   // chunks retrieved per query
const PASS_BAR   = 6;   // minimum relevant chunks for a query to PASS (6/8 = 75%)
const JUDGE_MODEL = 'claude-haiku-4-5-20251001';

// ── Env validation ────────────────────────────────────────────────────────────
const REQUIRED_VARS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_OPENAI_API_KEY', 'VITE_ANTHROPIC_API_KEY'];
const missing = REQUIRED_VARS.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`\nMissing required env vars: ${missing.join(', ')}`);
  console.error('Check your .env file.\n');
  process.exit(1);
}

const SUPABASE_URL   = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY   = process.env.VITE_SUPABASE_ANON_KEY;
const OPENAI_KEY     = process.env.VITE_OPENAI_API_KEY;
const ANTHROPIC_KEY  = process.env.VITE_ANTHROPIC_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const queries  = JSON.parse(fs.readFileSync(path.join(__dirname, 'queries.json'), 'utf8'));

// ── Embed ─────────────────────────────────────────────────────────────────────
async function embed(text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({ input: text, model: 'text-embedding-ada-002' }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI embed ${res.status}: ${body}`);
  }
  const { data } = await res.json();
  return data[0].embedding;
}

// ── Judge ─────────────────────────────────────────────────────────────────────
async function judge(query, chunk) {
  const prompt = `You are a strict retrieval quality evaluator for a fertility preservation app.

Query: "${query}"

Retrieved chunk:
"${chunk}"

Does this chunk help answer the query?

Score PASS if the chunk:
- Directly addresses the query topic
- Contains experience, information, or perspective that would help answer the question

Score FAIL if the chunk:
- Is about a different topic
- Mentions the query topic only incidentally
- Would not help a user asking this question

Respond on exactly two lines:
Line 1: PASS or FAIL
Line 2: One sentence explaining why.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: JUDGE_MODEL,
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic judge ${res.status}: ${body}`);
  }
  const { content } = await res.json();
  const text  = content[0]?.text?.trim() ?? '';
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const score = lines[0]?.toUpperCase().startsWith('PASS') ? 1 : 0;
  const reason = lines[1] ?? '(no reason)';
  return { score, reason };
}

// ── Main ──────────────────────────────────────────────────────────────────────
const timestamp = new Date().toISOString().slice(0, 10);
const runLabel  = `${timestamp}_n${MATCH_COUNT}`;

console.log(`\nWTF Retrieval Eval — ${runLabel}`);
console.log(`Queries: ${queries.length}  |  Chunks/query: ${MATCH_COUNT}  |  Pass bar: ${PASS_BAR}/${MATCH_COUNT}\n`);

const rows = [];
let queryPassCount = 0;
let queryErrorCount = 0;

for (const { id, query, category } of queries) {
  const label = `[${String(id).padStart(2)}] ${query.slice(0, 55).padEnd(55)}`;
  process.stdout.write(`${label} `);

  // 1. Embed
  let embedding;
  try {
    embedding = await embed(query);
  } catch (err) {
    process.stdout.write(`ERROR (embed)\n`);
    rows.push({ id, category, query, chunk_rank: '-', chunk_preview: '', score: '', reason: `EMBED_ERROR: ${err.message}`, query_score: '-', query_verdict: 'ERROR' });
    queryErrorCount++;
    continue;
  }

  // 2. Retrieve
  const { data: posts, error } = await supabase.rpc('match_posts', {
    query_embedding: embedding,
    match_count: MATCH_COUNT,
    filter_subreddit: null,
  });

  if (error) {
    process.stdout.write(`ERROR (supabase)\n`);
    rows.push({ id, category, query, chunk_rank: '-', chunk_preview: '', score: '', reason: `SUPABASE_ERROR: ${error.message}`, query_score: '-', query_verdict: 'ERROR' });
    queryErrorCount++;
    continue;
  }

  if (!posts || posts.length === 0) {
    process.stdout.write(`FAIL (0 chunks returned)\n`);
    rows.push({ id, category, query, chunk_rank: '-', chunk_preview: '', score: 0, reason: 'match_posts returned 0 results', query_score: '0/0', query_verdict: 'FAIL' });
    continue;
  }

  // 3. Judge all chunks in parallel
  const chunkResults = await Promise.all(
    posts.map(async (post, i) => {
      const chunk = post.chunk_text ?? '';
      let result;
      try {
        result = await judge(query, chunk);
      } catch (err) {
        result = { score: 0, reason: `JUDGE_ERROR: ${err.message}` };
      }
      return {
        id,
        category,
        query,
        chunk_rank: i + 1,
        chunk_preview: chunk.slice(0, 150).replace(/[\n\r]+/g, ' '),
        score: result.score,
        reason: result.reason,
      };
    })
  );

  // 4. Query-level verdict
  const passCount = chunkResults.reduce((sum, r) => sum + r.score, 0);
  const verdict   = passCount >= PASS_BAR ? 'PASS' : 'FAIL';
  const queryScore = `${passCount}/${posts.length}`;

  if (verdict === 'PASS') queryPassCount++;
  chunkResults.forEach(r => rows.push({ ...r, query_score: queryScore, query_verdict: verdict }));

  process.stdout.write(`${verdict} (${queryScore})\n`);
}

// ── Write CSV ─────────────────────────────────────────────────────────────────
const CSV_HEADERS = ['id', 'category', 'query', 'chunk_rank', 'chunk_preview', 'score', 'reason', 'query_score', 'query_verdict'];

const csvContent = [
  CSV_HEADERS.join(','),
  ...rows.map(row =>
    CSV_HEADERS.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')
  ),
].join('\n');

const resultsDir = path.join(__dirname, 'results');
fs.mkdirSync(resultsDir, { recursive: true });
const outPath = path.join(resultsDir, `${runLabel}.csv`);
fs.writeFileSync(outPath, csvContent, 'utf8');

// ── Summary ───────────────────────────────────────────────────────────────────
const validQueries = queries.length - queryErrorCount;
const passRate = validQueries > 0 ? ((queryPassCount / validQueries) * 100).toFixed(0) : 0;

console.log(`\n${'─'.repeat(60)}`);
console.log(`Run-level pass rate : ${queryPassCount}/${validQueries} queries passed (${passRate}%)`);
if (queryErrorCount > 0) console.log(`Errors              : ${queryErrorCount} queries could not be evaluated`);
console.log(`Results written to  : eval/results/${runLabel}.csv`);
console.log(`${'─'.repeat(60)}\n`);
console.log(`Next steps:`);
console.log(`  1. Open the CSV and read through 10 query results to calibrate your trust in the judge`);
console.log(`  2. Note any consistent patterns in FAIL queries — threshold issue vs. data gap?`);
console.log(`  3. To re-run with different params, edit MATCH_COUNT / PASS_BAR at the top of this file\n`);
