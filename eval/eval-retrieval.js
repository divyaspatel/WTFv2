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
 *   VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_ROLE_KEY, VITE_OPENAI_API_KEY, VITE_ANTHROPIC_API_KEY
 *
 * VITE_SUPABASE_SERVICE_ROLE_KEY: Supabase dashboard → Settings → API → service_role
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
// Change these to test different configurations, then compare CSV outputs.
const MATCH_COUNT       = 20;    // chunks retrieved per query
const MATCH_THRESHOLD   = 0.75;  // cosine similarity cutoff
const PASS_BAR          = 10;    // minimum relevant chunks for a query to PASS (10/20 = 50%)
const JUDGE_MODEL       = 'claude-haiku-4-5-20251001';
const HYDE_ENABLED      = true;  // embed a hypothetical answer instead of the raw question
const HYDE_MODEL        = 'claude-haiku-4-5-20251001';

// ── Env validation ────────────────────────────────────────────────────────────
const REQUIRED_VARS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_SERVICE_ROLE_KEY', 'VITE_OPENAI_API_KEY', 'VITE_ANTHROPIC_API_KEY'];
const missing = REQUIRED_VARS.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`\nMissing required env vars: ${missing.join(', ')}`);
  console.error('\nVITE_SUPABASE_SERVICE_ROLE_KEY: Supabase dashboard → Settings → API → service_role\n');
  process.exit(1);
}

const SUPABASE_URL   = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY   = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
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

// ── HyDE ──────────────────────────────────────────────────────────────────────
// Generates a hypothetical Reddit-style answer post so the embedding lands in
// "answer space" rather than "question space" — reduces question-posts ranking
// over answer-posts in cosine similarity.
async function generateHypotheticalDoc(query) {
  const prompt = `You are a woman who has been through egg freezing or IVF. Write a short Reddit post (2-4 sentences) that directly answers this question from personal experience. Be specific and practical. Do not add a title or preamble — just the post body.

Question: "${query}"`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: HYDE_MODEL,
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HyDE generation ${res.status}: ${body}`);
  }
  const { content } = await res.json();
  return content[0]?.text?.trim() ?? query;
}

// ── Judge ─────────────────────────────────────────────────────────────────────
async function judge(query, chunk) {
  const prompt = `You are a retrieval quality evaluator for a fertility preservation app.

Query: "${query}"

Retrieved chunk:
"${chunk}"

Does this chunk contain information useful to someone asking this question?

Score PASS if the chunk:
- Contains any relevant information that would help answer the query, even partially
- Shares a personal experience, number, cost, or anecdote that relates to the topic — a single data point counts
- Would add value as one piece of context alongside other retrieved chunks

Score FAIL if the chunk:
- Is about a completely different topic
- Only mentions the query topic in passing without adding any substance

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
const VERSION   = 'hyde-with-doc';
const runLabel  = `${timestamp}_n${MATCH_COUNT}_t${String(MATCH_THRESHOLD).replace('.', '')}_v${VERSION}`;

console.log(`\nWTF Retrieval Eval — ${runLabel}`);
console.log(`Queries: ${queries.length}  |  Chunks/query: ${MATCH_COUNT}  |  Pass bar: ${PASS_BAR}/${MATCH_COUNT}  |  HyDE: ${HYDE_ENABLED}\n`);

const rows = [];
let queryPassCount = 0;
let queryErrorCount = 0;

for (const { id, query, category } of queries) {
  const label = `[${String(id).padStart(2)}] ${query.slice(0, 55).padEnd(55)}`;
  process.stdout.write(`${label} `);

  // 1. Embed (optionally via HyDE: generate a hypothetical answer first)
  let embedding;
  let hydeDoc = '';
  try {
    const textToEmbed = HYDE_ENABLED ? (hydeDoc = await generateHypotheticalDoc(query)) : query;
    embedding = await embed(textToEmbed);
  } catch (err) {
    process.stdout.write(`ERROR (embed)\n`);
    rows.push({ id, category, query, hyde_doc: hydeDoc, chunk_rank: '-', chunk_preview: '', score: '', reason: `EMBED_ERROR: ${err.message}`, query_score: '-', query_verdict: 'ERROR' });
    queryErrorCount++;
    continue;
  }

  // 2. Retrieve
  const { data: posts, error } = await supabase.rpc('match_posts', {
    query_embedding: embedding,
    match_threshold: MATCH_THRESHOLD,
    match_count: MATCH_COUNT,
    stage_filter: null,
  });

  if (error) {
    process.stdout.write(`ERROR (supabase)\n`);
    rows.push({ id, category, query, chunk_rank: '-', chunk_preview: '', score: '', reason: `SUPABASE_ERROR: ${error.message}`, query_score: '-', query_verdict: 'ERROR' });
    queryErrorCount++;
    continue;
  }

  if (!posts || posts.length === 0) {
    process.stdout.write(`FAIL (0 chunks returned)\n`);
    rows.push({ id, category, query, hyde_doc: hydeDoc, chunk_rank: '-', chunk_preview: '', score: 0, reason: 'match_posts returned 0 results', query_score: '0/0', query_verdict: 'FAIL' });
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
        hyde_doc: hydeDoc,
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
const CSV_HEADERS = ['id', 'category', 'query', 'hyde_doc', 'chunk_rank', 'chunk_preview', 'score', 'reason', 'query_score', 'query_verdict'];

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
