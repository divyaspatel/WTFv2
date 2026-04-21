// Edge Function: wtf-chat
// Secrets required (set via: supabase secrets set KEY=value):
//   OPENAI_API_KEY, ANTHROPIC_API_KEY
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are auto-injected by Supabase.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STAGE_LABELS: Record<string, string> = {
  considering: 'Considering whether to freeze eggs or embryos',
  active:      'Getting started — decided to freeze, figuring out next steps',
  in_process:  'Currently in stimulation, monitoring, or retrieval',
};

const FALLBACK =
  "That's not something that comes up as often in the community data I have — which usually means it's pretty specific to your situation. I'd bring this one directly to your RE. What I can tell you is what women at your stage were generally asking about — want me to share that instead?";

function buildSystemPrompt(stage: string, context: string): string {
  return `You are WTF — a warm, knowledgeable friend helping women navigate fertility preservation.
You are NOT a doctor, nurse, or medical authority.

The user is at the following stage of their journey: ${STAGE_LABELS[stage] ?? stage}.

You have access to real community experience from thousands of women who've posted on r/eggfreezing and r/IVF. Here is relevant context from that community:

---
${context}
---

How to respond:
- Sound like a knowledgeable girlfriend, not a medical professional
- Ground every answer in the community context above — cite patterns, percentages, common experiences
- Use phrases like "A lot of women said...", "The community talks about this a lot...", "Many posts from women at this stage mentioned..."
- Express data as % splits or ranges, never as single facts or recommendations
- Never make absolute recommendations ("you should", "you need to", "you must")
- Never cite studies, papers, or clinical guidelines
- Never give dosage recommendations under any circumstances
- If the user asks about something medical and specific, share what the community said AND tell them to bring it to their RE
- Keep responses conversational — 3–5 short paragraphs max
- If the question is outside fertility preservation (egg/embryo freezing), redirect warmly`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const { message, stage, history } = await req.json();

  // 1. Embed user message
  const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
    },
    body: JSON.stringify({ input: message, model: 'text-embedding-ada-002' }),
  });
  if (!embedRes.ok) throw new Error(`Embed ${embedRes.status}: ${await embedRes.text()}`);
  const { data } = await embedRes.json();
  const embedding = data[0].embedding;

  // 2. Retrieve community posts
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: posts, error } = await supabase.rpc('match_posts', {
    query_embedding: embedding,
    match_threshold: 0.75,
    match_count: 8,
    stage_filter: null,
  });
  if (error) throw error;

  // 3. Zero results — stream a fallback event then close
  if (!posts || posts.length === 0) {
    const body = `data: ${JSON.stringify({ type: 'fallback', text: FALLBACK })}\n\ndata: [DONE]\n\n`;
    return new Response(body, {
      headers: { ...CORS, 'Content-Type': 'text/event-stream' },
    });
  }

  // 4. Stream Anthropic response
  const context = posts.map((p: { content: string }) => p.content).join('\n\n');
  const messages = [...(history ?? []), { role: 'user', content: message }];

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      stream: true,
      system: buildSystemPrompt(stage, context),
      messages,
    }),
  });
  if (!anthropicRes.ok) throw new Error(`Anthropic ${anthropicRes.status}: ${await anthropicRes.text()}`);

  // Pipe Anthropic SSE stream directly back to client
  return new Response(anthropicRes.body, {
    headers: {
      ...CORS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
});
