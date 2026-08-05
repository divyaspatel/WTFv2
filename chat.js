// chat.js — RAG chat via Supabase Edge Function (wtf-chat)
// All API calls run server-side. Client only needs VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.
// Exposes createChatSurface(), a factory that binds the shared streaming/telemetry
// logic to any set of chat DOM elements (full-screen chat + stage-detail dock).

const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnc3hjbnhmc2F3cGxraWVvY2hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MTA5NDUsImV4cCI6MjA4NzE4Njk0NX0.PGQMJv7fdRraBhatDIWp3s6qnksLxxDmPVsxr1bSOuw';
const SUPABASE_URL = 'https://agsxcnxfsawplkieochk.supabase.co';
const EDGE_URL = `${SUPABASE_URL}/functions/v1/wtf-chat`;

const SESSION_ID = (() => {
  let id = sessionStorage.getItem('wtf_session');
  if (!id) { id = crypto.randomUUID(); sessionStorage.setItem('wtf_session', id); }
  return id;
})();

const isMobile = () => window.matchMedia('(pointer: coarse)').matches;

// ── Shared state ──────────────────────────────────────────────────────────────
let stage = 'active';
export function setStage(s) { stage = s; }

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

// ── Telemetry ─────────────────────────────────────────────────────────────────
async function post(table, body) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
        'apikey': ANON_KEY,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(body),
    });
  } catch { /* fail silently */ }
}

// ── Chat surface factory ──────────────────────────────────────────────────────
// ids: { msgs, empty, chips?, input, send }  — element ids, no '#'
// getMilestone: () => current milestone id or null (for telemetry context)
export function createChatSurface({ ids, getMilestone = () => null }) {
  const msgsEl  = document.getElementById(ids.msgs);
  const emptyEl = document.getElementById(ids.empty);
  const chipsEl = ids.chips ? document.getElementById(ids.chips) : null;
  const inputEl = document.getElementById(ids.input);
  const sendEl  = document.getElementById(ids.send);

  let busy = false;
  let typingEl = null;
  const history = [];

  function scrollMsgs() { msgsEl.scrollTop = msgsEl.scrollHeight; }

  function showMessages() {
    msgsEl.classList.add('has-msgs');
    if (emptyEl) emptyEl.classList.add('hidden');
  }

  function appendUserBubble(text) {
    showMessages();
    const div = document.createElement('div');
    div.className = 'msg u';
    div.innerHTML = `<div class="msg-row"><div class="m-bbl">${esc(text)}</div></div>`;
    msgsEl.appendChild(div);
    scrollMsgs();
  }

  function appendBotBubble() {
    const div = document.createElement('div');
    div.className = 'msg b';
    div.innerHTML = `<div class="msg-row"><div class="m-av">W</div><div class="m-bbl"></div></div>`;
    msgsEl.appendChild(div);
    scrollMsgs();
    return div.querySelector('.m-bbl');
  }

  function showTyping() {
    typingEl = document.createElement('div');
    typingEl.className = 'msg b';
    typingEl.innerHTML = `<div class="t-row"><div class="m-av">W</div><div class="t-bbl"><span class="t-txt">Give me a minute…</span><div class="t-dots"><div class="td"></div><div class="td"></div><div class="td"></div></div></div></div>`;
    msgsEl.appendChild(typingEl);
    scrollMsgs();
  }

  function removeTyping() {
    typingEl?.remove();
    typingEl = null;
  }

  function logChatMessage(question, response) {
    post('chat_messages', {
      session_id: SESSION_ID,
      stage,
      milestone: getMilestone(),
      question,
      response,
      is_mobile: isMobile(),
    });
  }

  function logChatFeedback(verdict, text, question, response) {
    if (!verdict) return;
    post('feedback_events', {
      user_session_id: SESSION_ID,
      source: 'chatbot',
      verdict,
      optional_text: text || null,
      milestone: getMilestone(),
      section: stage,
      question,
      bot_response: response,
    });
  }

  // ── Per-response feedback widget ────────────────────────────────────────────
  function appendChatFeedback(msgDiv, question, response) {
    const fb = document.createElement('div');
    fb.className = 'msg-fb';
    fb.innerHTML = `
      <div class="mfb-btns">
        <button class="mfb-btn up" aria-label="Helpful">👍</button>
        <button class="mfb-btn dn" aria-label="Not helpful">👎</button>
      </div>
      <div class="mfb-form" hidden>
        <input class="mfb-txt" type="text" placeholder="Your feedback on this response (optional)" maxlength="280">
        <div class="mfb-acts">
          <button class="mfb-send">Send</button>
        </div>
      </div>
    `;

    const upBtn = fb.querySelector('.mfb-btn.up');
    const dnBtn = fb.querySelector('.mfb-btn.dn');
    const form  = fb.querySelector('.mfb-form');
    const txt   = fb.querySelector('.mfb-txt');
    const send  = fb.querySelector('.mfb-send');
    let verdict = null;

    function selectVerdict(v) {
      verdict = v;
      upBtn.classList.toggle('selected', v === 'up');
      dnBtn.classList.toggle('selected', v === 'down');
      form.removeAttribute('hidden');
      txt.focus();
    }

    function submit(comment) {
      logChatFeedback(verdict, comment, question, response);
      fb.innerHTML = '<span class="mfb-thanks">Thanks ✓</span>';
    }

    upBtn.addEventListener('click', () => selectVerdict('up'));
    dnBtn.addEventListener('click', () => selectVerdict('down'));
    send.addEventListener('click', () => submit(txt.value.trim()));
    txt.addEventListener('keydown', e => { if (e.key === 'Enter') submit(txt.value.trim()); });

    msgDiv.appendChild(fb);
  }

  // ── Core handler ────────────────────────────────────────────────────────────
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
              scrollMsgs();
            }
          } catch { /* skip malformed SSE line */ }
        }
      }

      logChatMessage(text, full);
      appendChatFeedback(bubble.closest('.msg'), text, full);

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

  // ── Chips ───────────────────────────────────────────────────────────────────
  function setChips(chips) {
    if (!chipsEl) return;
    chipsEl.innerHTML = chips.map(t =>
      `<div class="dock-chip" data-prompt="${esc(t)}">${esc(t)}</div>`
    ).join('');
    chipsEl.querySelectorAll('.dock-chip').forEach(c =>
      c.addEventListener('click', () => {
        if (busy) return;
        handle(c.dataset.prompt);
      })
    );
  }

  // ── Input wiring ────────────────────────────────────────────────────────────
  function submit() {
    const val = inputEl.value.trim();
    if (!val || busy) return;
    inputEl.value = '';
    handle(val);
  }

  sendEl.addEventListener('click', submit);
  inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });

  return { send: handle, setChips };
}
