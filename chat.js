// chat.js — RAG chat via Supabase Edge Function (wtf-chat)
// All API calls run server-side. Client only needs VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.

const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnc3hjbnhmc2F3cGxraWVvY2hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MTA5NDUsImV4cCI6MjA4NzE4Njk0NX0.PGQMJv7fdRraBhatDIWp3s6qnksLxxDmPVsxr1bSOuw';
const EDGE_URL = 'https://agsxcnxfsawplkieochk.supabase.co/functions/v1/wtf-chat';

// ── DOM helpers ───────────────────────────────────────────────────────────────
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderMarkdown(text) {
  const lines = text.split('\n');
  const out = [];
  let inUl = false;
  let inOl = false;

  function inline(s) {
    return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }
  function closeUl() { if (inUl) { out.push('</ul>'); inUl = false; } }
  function closeOl() { if (inOl) { out.push('</ol>'); inOl = false; } }

  for (const line of lines) {
    const ulMatch = line.match(/^[-*]\s+(.+)/);
    const olMatch = line.match(/^\d+\.\s+(.+)/);
    if (ulMatch) {
      closeOl();
      if (!inUl) { out.push('<ul>'); inUl = true; }
      out.push(`<li>${inline(ulMatch[1])}</li>`);
    } else if (olMatch) {
      closeUl();
      if (!inOl) { out.push('<ol>'); inOl = true; }
      out.push(`<li>${inline(olMatch[1])}</li>`);
    } else {
      closeUl();
      closeOl();
      if (line.trim()) out.push(`${inline(line)}<br>`);
    }
  }
  closeUl();
  closeOl();
  return out.join('').replace(/(<br>)+$/, '');
}

function getDockMsgs()  { return document.getElementById('dock-msgs'); }
function getDockEmpty() { return document.getElementById('dock-empty'); }

function scrollDock() {
  const el = getDockMsgs();
  if (el) el.scrollTop = el.scrollHeight;
}

function showMessages() {
  getDockMsgs().classList.add('has-msgs');
  const empty = getDockEmpty();
  if (empty) empty.classList.add('hidden');
}

function appendUserBubble(text) {
  showMessages();
  const msgs = getDockMsgs();
  const div = document.createElement('div');
  div.className = 'msg u';
  div.innerHTML = `<div class="msg-row"><div class="m-bbl">${esc(text)}</div></div>`;
  msgs.appendChild(div);
  scrollDock();
}

function appendBotBubble() {
  const msgs = getDockMsgs();
  const div = document.createElement('div');
  div.className = 'msg b';
  const id = `bubble-${Date.now()}`;
  div.innerHTML = `<div class="msg-row"><div class="m-av">W</div><div class="m-bbl" id="${id}"></div></div>`;
  msgs.appendChild(div);
  scrollDock();
  return document.getElementById(id);
}

function showTyping() {
  const msgs = getDockMsgs();
  const div = document.createElement('div');
  div.className = 'msg b';
  div.id = 'typing-indicator';
  div.innerHTML = `<div class="t-row"><div class="m-av">W</div><div class="t-bbl"><div class="td"></div><div class="td"></div><div class="td"></div></div></div>`;
  msgs.appendChild(div);
  scrollDock();
}

function removeTyping() {
  document.getElementById('typing-indicator')?.remove();
}

// ── Dock chips ────────────────────────────────────────────────────────────────
export function setDockChips(chips) {
  const el = document.getElementById('dock-chips');
  if (!el) return;
  el.innerHTML = chips.map(t =>
    `<div class="dock-chip" data-prompt="${esc(t)}">${esc(t)}</div>`
  ).join('');
  el.querySelectorAll('.dock-chip').forEach(c =>
    c.addEventListener('click', () => {
      if (busy) return;
      handle(c.dataset.prompt);
    })
  );
}

// ── State ─────────────────────────────────────────────────────────────────────
let busy = false;
let stage = 'active';
const history = [];

// ── Core handler ──────────────────────────────────────────────────────────────
async function handle(text) {
  if (busy || !text.trim()) return;
  busy = true;

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

    if (!res.ok) throw new Error(`Edge fn ${res.status}: ${await res.text()}`);

    removeTyping();
    const bubble = appendBotBubble();
    let full = '';

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
            bubble.innerHTML = renderMarkdown(full);
          } else if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
            full += evt.delta.text;
            bubble.innerHTML = renderMarkdown(full);
            scrollDock();
          }
        } catch { /* skip malformed SSE line */ }
      }
    }

    history.push({ role: 'user', content: text });
    history.push({ role: 'assistant', content: full });
  } catch (err) {
    removeTyping();
    const bubble = appendBotBubble();
    bubble.textContent = 'Something went wrong — try again in a moment.';
    console.error('[chat]', err);
  }

  busy = false;
}

// ── Init ──────────────────────────────────────────────────────────────────────
export function initDockChat(initialStage = 'active') {
  stage = initialStage;

  const inp = document.getElementById('dock-inp');
  const snd = document.getElementById('dock-snd');

  function submit() {
    const val = inp.value.trim();
    if (!val || busy) return;
    inp.value = '';
    handle(val);
  }

  snd.addEventListener('click', submit);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
}
