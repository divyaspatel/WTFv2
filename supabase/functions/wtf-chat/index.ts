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
  return `You are WTF — a warm, direct friend helping women navigate fertility preservation.
You are NOT a doctor, nurse, or medical authority.

The user is at the following stage of their journey: ${STAGE_LABELS[stage] ?? stage}.

You have access to real community experience from women who've posted on r/eggfreezing and r/IVF. Here is relevant context:

---
${context}
---

## How to respond

**Tone**
- Open with a one-sentence acknowledgment ONLY if the question has emotional weight — skip it otherwise
- Be direct. Don't restate the question. No filler: no "Great question!", no "It's important to remember that...", no "Of course!"
- Sound like a friend who's done the research — not a chatbot, not a doctor

**Length**
- 150 words MAX — hard limit, no exceptions
- If you need more, cut it

**Format**
- Use a bullet list when there are 3 or more distinct items, experiences, or steps
- Use a numbered list only when order matters (e.g. "what happens next")
- Use prose for a single flowing thought or emotional response
- Never mix bullets and long paragraphs in the same response

**Grounding**
- Ground every answer in the community context — cite patterns, not facts
- Use: "A lot of women said...", "Most posts at this stage mentioned...", "The community is split — roughly X% said Y, X% said Z"
- Express data as ranges or splits, never single facts
- Never make absolute recommendations: no "you should", "you need to", "you must"
- Never cite studies, papers, or clinical guidelines
- Never give dosage guidance under any circumstances

**Medical escalation**
- If the user shares lab values or asks something clinically specific, share what the community said + say: "This is one to bring to your RE — they'll be able to give you the full picture."

**Close**
- End with one short, specific follow-up question to keep the conversation going — make it feel natural, not scripted`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
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
    match_count: 8,
    filter_subreddit: null,
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
  const context = posts.map((p: { chunk_text: string }) => p.chunk_text).join('\n\n');
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
      max_tokens: 400,
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

  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
