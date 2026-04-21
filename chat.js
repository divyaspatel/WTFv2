// chat.js — RAG chat via Supabase Edge Function (wtf-chat)
// Client only needs VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.
// OpenAI and Anthropic keys live in the Edge Function environment only.

// import.meta.env is Vite-specific — replaced at build time.
// Guard with ?. so raw-browser serving fails gracefully instead of hard-crashing.
const ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY ?? '';
const EDGE_URL = 'https://agsxcnxfsawplkieochk.supabase.co/functions/v1/wtf-chat';

const STARTER_CHIPS = [
  'Where do I even start?',
  'How painful are the injections?',
  'What does it actually cost?',
];

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
  const id = `bubble-${Date.now()}`;
  div.innerHTML = `<div class="msg-row"><div class="m-av">W</div><div class="m-bbl" id="${id}"></div></div>`;
  msgs.appendChild(div);
  scrollMsgs();
  return document.getElementById(id);
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

  try {
    const res = await fetch(EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ message: text, stage, history }),
    });

    if (!res.ok) throw new Error(`Edge function ${res.status}: ${await res.text()}`);

    removeTyping();
    const bubble = appendBotBubble();
    let full = '';

    // Parse SSE stream (Anthropic format, plus our fallback event)
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      const lines = buf.split('\n');
      buf = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const evt = JSON.parse(payload);
          if (evt.type === 'fallback') {
            full = evt.text;
            bubble.textContent = full;
          } else if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
            full += evt.delta.text;
            bubble.innerHTML = esc(full).replace(/\n/g, '<br>');
            scrollMsgs();
          }
        } catch { /* skip malformed SSE line */ }
      }
    }

    history.push({ role: 'user', content: text });
    history.push({ role: 'assistant', content: full });
  } catch (err) {
    removeTyping();
    const bubble = appendBotBubble();
    const msg = 'Something went wrong — try again in a moment.';
    bubble.textContent = msg;
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
