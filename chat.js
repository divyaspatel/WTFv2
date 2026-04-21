// chat.js — RAG-powered chat (S4)
// Depends on: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
//             VITE_OPENAI_API_KEY, VITE_ANTHROPIC_API_KEY
// Called from app.js: initChat(stage)

import { createClient } from '@supabase/supabase-js';

// ── Clients ───────────────────────────────────────────────────────────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ── Constants (source of truth is CLAUDE.md) ──────────────────────────────────
const EMBED_URL   = 'https://api.openai.com/v1/embeddings';
const EMBED_MODEL = 'text-embedding-ada-002';
const CHAT_MODEL  = 'claude-sonnet-4-6';
const CHAT_URL    = 'https://api.anthropic.com/v1/messages';

const STAGE_LABELS = {
  considering: 'Considering whether to freeze eggs or embryos',
  active:      'Getting started — decided to freeze, figuring out next steps',
  in_process:  'Currently in stimulation, monitoring, or retrieval',
};

const STARTER_CHIPS = [
  'Where do I even start?',
  'How painful are the injections?',
  'What does it actually cost?',
];

const FALLBACK =
  "That's not something that comes up as often in the community data I have — which usually means it's pretty specific to your situation. I'd bring this one directly to your RE. What I can tell you is what women at your stage were generally asking about — want me to share that instead?";

// ── Embedding ─────────────────────────────────────────────────────────────────
async function embed(text) {
  const res = await fetch(EMBED_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ input: text, model: EMBED_MODEL }),
  });
  if (!res.ok) throw new Error(`Embeddings ${res.status}: ${await res.text()}`);
  const { data } = await res.json();
  return data[0].embedding;
}

// ── Supabase retrieval ────────────────────────────────────────────────────────
async function searchPosts(query, stage) {
  const embedding = await embed(query);
  const { data, error } = await supabase.rpc('match_posts', {
    query_embedding: embedding,
    match_threshold: 0.75,
    match_count: 5,
    stage_filter: null, // stage filtering not yet persisted to posts table; pass null
  });
  if (error) throw error;
  return data ?? [];
}

// ── System prompt ─────────────────────────────────────────────────────────────
function buildSystemPrompt(stage, communityContext) {
  return `You are WTF — a warm, knowledgeable friend helping women navigate fertility preservation.
You are NOT a doctor, nurse, or medical authority.

The user is at the following stage of their journey: ${STAGE_LABELS[stage] ?? stage}.

You have access to real community experience from thousands of women who've posted on r/eggfreezing and r/IVF. Here is relevant context from that community:

---
${communityContext}
---

How to respond:
- Sound like a knowledgeable girlfriend, not a medical professional
- Ground every answer in the community context above — cite patterns, percentages, common experiences
- Use phrases like "A lot of women said...", "The community talks about this a lot...", "Many posts from women at this stage mentioned..."
- Express data as % splits or ranges, never as single facts or recommendations
- Never make absolute recommendations ("you should", "you need to", "you must")
- Never cite studies, papers, or clinical guidelines
- Never give dosage recommendations under any circumstances
- If the user asks about something medical and specific (dosages, lab values), share what the community said AND tell them to bring it to their RE
- Keep responses conversational — 3–5 short paragraphs max, no bullet lists unless listing distinct community experiences
- If the question is outside fertility preservation (egg/embryo freezing), redirect warmly: "That's a little outside what I know well — I'm really only useful for the fertility preservation piece."`;
}

// ── Anthropic streaming ───────────────────────────────────────────────────────
async function streamReply(systemPrompt, messages, onChunk) {
  const res = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      max_tokens: 1024,
      stream: true,
      system: systemPrompt,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    // split on newlines; keep last partial line in buffer
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (!payload) continue;
      try {
        const evt = JSON.parse(payload);
        if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
          onChunk(evt.delta.text);
        }
      } catch { /* skip malformed SSE line */ }
    }
  }
}

// ── DOM helpers ───────────────────────────────────────────────────────────────
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function scrollMsgs() {
  const el = document.getElementById('msgs');
  if (el) el.scrollTop = el.scrollHeight;
}

function appendUserBubble(text) {
  const msgs = document.getElementById('msgs');
  const div = document.createElement('div');
  div.className = 'msg u';
  div.innerHTML = `<div class="msg-row"><div class="m-bbl">${esc(text)}</div></div>`;
  msgs.appendChild(div);
  scrollMsgs();
}

function appendBotBubble() {
  const msgs = document.getElementById('msgs');
  const div = document.createElement('div');
  div.className = 'msg b';
  const bubbleId = `bubble-${Date.now()}`;
  div.innerHTML = `<div class="msg-row"><div class="m-av">W</div><div class="m-bbl" id="${bubbleId}"></div></div>`;
  msgs.appendChild(div);
  scrollMsgs();
  return document.getElementById(bubbleId);
}

function showTyping() {
  const msgs = document.getElementById('msgs');
  const div = document.createElement('div');
  div.className = 'msg b';
  div.id = 'typing-indicator';
  div.innerHTML = `<div class="t-row"><div class="m-av">W</div><div class="t-bbl"><div class="td"></div><div class="td"></div><div class="td"></div></div></div>`;
  msgs.appendChild(div);
  scrollMsgs();
}

function removeTyping() {
  document.getElementById('typing-indicator')?.remove();
}

function setChips(chips) {
  const el = document.getElementById('chips');
  el.innerHTML = chips.map(t =>
    `<div class="chip" data-prompt="${esc(t)}">${esc(t)}</div>`
  ).join('');
  el.querySelectorAll('.chip').forEach(c =>
    c.addEventListener('click', () => {
      if (busy) return;
      c.classList.add('used');
      handle(c.dataset.prompt);
    })
  );
}

// ── State ─────────────────────────────────────────────────────────────────────
let busy = false;
let stage = 'active';
const history = []; // { role: 'user'|'assistant', content: string }

// ── Core handler ──────────────────────────────────────────────────────────────
async function handle(text) {
  if (busy || !text.trim()) return;
  busy = true;

  document.getElementById('chips').innerHTML = '';
  appendUserBubble(text);
  showTyping();

  history.push({ role: 'user', content: text });

  try {
    const posts = await searchPosts(text, stage);
    removeTyping();

    if (posts.length === 0) {
      const bubble = appendBotBubble();
      bubble.textContent = FALLBACK;
      history.push({ role: 'assistant', content: FALLBACK });
    } else {
      const context = posts.map(p => p.content).join('\n\n');
      const systemPrompt = buildSystemPrompt(stage, context);
      const bubble = appendBotBubble();
      let full = '';

      await streamReply(systemPrompt, history, (chunk) => {
        full += chunk;
        // render newlines as <br> while streaming
        bubble.innerHTML = esc(full).replace(/\n/g, '<br>');
        scrollMsgs();
      });

      history.push({ role: 'assistant', content: full });
    }
  } catch (err) {
    removeTyping();
    const bubble = appendBotBubble();
    const msg = "Something went wrong — try again in a moment.";
    bubble.textContent = msg;
    history.push({ role: 'assistant', content: msg });
    console.error('[chat]', err);
  }

  busy = false;
}

// ── Init (called from app.js) ─────────────────────────────────────────────────
export function initChat(initialStage = 'active') {
  stage = initialStage;

  setChips(STARTER_CHIPS);

  const inp = document.getElementById('inp');
  const snd = document.getElementById('snd-btn');

  function submit() {
    const val = inp.value.trim();
    if (!val || busy) return;
    inp.value = '';
    handle(val);
  }

  snd.addEventListener('click', submit);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
}
