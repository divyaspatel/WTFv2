import { EDITORIAL } from './editorial_content.js';

// ── State ──────────────────────────────────────────────────────────────────
let currentStage = 'active';
let chatBusy = false;
let chipPhase = 0;

// ── Navigation ─────────────────────────────────────────────────────────────
function go(id) {
  document.querySelectorAll('.scr').forEach(s => s.classList.remove('on'));
  document.getElementById(id).classList.add('on');
  if (id === 's4') {
    setTimeout(() => {
      const msgs = document.getElementById('msgs');
      msgs.scrollTop = msgs.scrollHeight;
    }, 50);
  }
}

// ── Editorial rendering ────────────────────────────────────────────────────
function renderEditorial(stage) {
  const d = EDITORIAL[stage];
  if (!d) return;
  const scroll = document.getElementById('edScroll');

  const parasToHtml = (arr) => arr.map(p => `<p class="ed-bdy">${p}</p>`).join('');

  const fearsHtml = d.what_they_were_afraid_of.fears.map(f => `
    <div class="fi">
      <span class="fi-pct">${f.pct}</span>
      <span class="fi-txt">${f.text}</span>
    </div>`).join('');

  const outcomesHtml = d.what_actually_happened.outcomes.map(o => `
    <div class="oi">
      <div class="oi-stat">${o.stat}</div>
      <div class="oi-txt">${o.text}</div>
    </div>`).join('');

  const quotesHtml = d.what_they_wish_theyd_known.quotes.map(q => `
    <div class="wb"><div class="wb-txt">"${q}"</div></div>`).join('');

  scroll.innerHTML = `
    <div class="ed-hero">
      <div class="ed-pill">${d.meta.label}</div>
      <div class="ed-ttl">${d.meta.headline}</div>
      <div class="ed-lead">${d.meta.lead}</div>
    </div>

    <div class="ed-sec">
      <div class="ed-lbl"><span>${d.you_are_not_alone.section_label}</span></div>
      <div class="ed-sttl">${d.you_are_not_alone.subtitle}</div>
      ${parasToHtml(d.you_are_not_alone.body)}
    </div>

    <div class="ed-sec">
      <div class="ed-lbl"><span>${d.what_they_were_afraid_of.section_label}</span></div>
      <div class="ed-sttl">${d.what_they_were_afraid_of.subtitle}</div>
      <div class="fl">${fearsHtml}</div>
    </div>

    <div class="ed-sec">
      <div class="ed-lbl"><span>${d.what_actually_happened.section_label}</span></div>
      <div class="ed-sttl">${d.what_actually_happened.subtitle}</div>
      ${outcomesHtml}
    </div>

    <div class="ed-sec">
      <div class="ed-lbl"><span>${d.what_they_wish_theyd_known.section_label}</span></div>
      <div class="ed-sttl">${d.what_they_wish_theyd_known.subtitle}</div>
      ${quotesHtml}
      <p class="wb-close">${d.what_they_wish_theyd_known.closing}</p>
    </div>
  `;
}

// ── Chat chips ─────────────────────────────────────────────────────────────
const CHIPS = [
  ['Where do I start?', 'How painful is it?', 'What does it cost?', 'Pick a clinic?'],
  ['How many eggs do I need?', 'What should I ask my doctor?', 'How long does it take?'],
];

function renderChips(phase) {
  const el = document.getElementById('chips');
  el.innerHTML = CHIPS[phase].map(t =>
    `<div class="chip" data-prompt="${t}">${t}</div>`
  ).join('');
  el.querySelectorAll('.chip').forEach(c =>
    c.addEventListener('click', () => {
      if (chatBusy) return;
      c.classList.add('used');
      handleMessage(c.dataset.prompt);
    })
  );
}

// ── Static chat responses (replaced by RAG in build step 3) ───────────────
const CANNED = {
  'Where do I start?':
    "The community is pretty united on this: start with your baseline bloodwork. Most women book a consultation with an REI (reproductive endocrinologist) — or their OB-GYN — to get AMH and AFC tested first. It tells you where your ovarian reserve stands and helps your doctor recommend a protocol.\n\nA lot of women said they wished they'd made that first appointment sooner. It felt scary, but it ended up being the most clarifying step.",

  'How painful is it?':
    "Honest answer from the community: more manageable than most women expected. Daily injections are usually described as a quick pinch — uncomfortable, not excruciating.\n\nThe bloating and fullness from stimulation, especially in the last few days, was what more women flagged as genuinely uncomfortable. The retrieval is done under sedation, so most women didn't feel it. The day or two after can feel crampy and tender.",

  'What does it cost?':
    "One of the most-asked questions. Without insurance, most women reported $10,000–$15,000 per cycle, plus medications running another $3,000–$5,000 separately.\n\nMany had partial coverage through employer platforms like Progyny or Carrot. The advice that came up most consistently: call your insurance before you do anything else. Coverage varies wildly, and knowing your situation early changes your whole plan.",

  'Pick a clinic?':
    "The community has strong opinions here. SART success rate data is a starting point — but how a clinic communicates during the process matters just as much.\n\nWomen mentioned responsiveness, clear billing upfront, and monitoring appointment structure as underrated factors. Most women consulted 2–3 clinics before deciding. If a clinic is dismissive or vague about costs in the first consultation, that's usually a sign.",

  'How many eggs do I need?':
    "The most common question in the community — and genuinely hard to answer cleanly, because it depends on age, egg quality, and whether you want eggs vs. embryos.\n\nWomen in their early-to-mid 30s most often talked about aiming for 10–20 mature eggs, but the right number looked different for everyone. This is a conversation to have directly with your RE once you have your baseline numbers in hand.",

  'What should I ask my doctor?':
    "The community built a solid list from experience. What came up most:\n\n· What do my AMH and AFC mean for my protocol?\n· How many cycles do you think I'll likely need?\n· What does monitoring look like — how early, how often?\n· What's in the base price vs. what's extra?\n· What happens if I respond poorly to stimulation?\n\nNot being afraid to ask about money upfront saved a lot of stress later.",

  'How long does it take?':
    "From first appointment to retrieval, most women said to plan for 4–6 weeks total. The stimulation phase itself is typically 10–14 days of daily injections.\n\nWhat many didn't anticipate: the time between deciding to go forward and actually starting can be longer than expected — especially if insurance requires prior auth or your cycle timing doesn't align right away.",
};

const FALLBACK =
  "That comes up in the community too. The honest answer is it really depends on your situation — your numbers, your clinic, your protocol. Tell me a bit more about where you are and I can share what women in similar situations have said.";

// ── Chat helpers ───────────────────────────────────────────────────────────
function addMsg(role, text) {
  const msgs = document.getElementById('msgs');
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  const escaped = text.replace(/\n/g, '<br>');
  div.innerHTML = role === 'b'
    ? `<div class="msg-row"><div class="m-av">W</div><div class="m-bbl">${escaped}</div></div>`
    : `<div class="msg-row"><div class="m-bbl">${escaped}</div></div>`;
  msgs.appendChild(div);
  setTimeout(() => { msgs.scrollTop = msgs.scrollHeight; }, 30);
}

function showTyping() {
  const msgs = document.getElementById('msgs');
  const div = document.createElement('div');
  div.className = 'msg b';
  div.id = 'typing';
  div.innerHTML = `<div class="t-row"><div class="m-av">W</div><div class="t-bbl"><div class="td"></div><div class="td"></div><div class="td"></div></div></div>`;
  msgs.appendChild(div);
  setTimeout(() => { msgs.scrollTop = msgs.scrollHeight; }, 30);
}

function removeTyping() {
  document.getElementById('typing')?.remove();
}

function handleMessage(text) {
  chatBusy = true;
  addMsg('u', text);
  showTyping();
  const reply = CANNED[text] ?? FALLBACK;
  const delay = 1100 + Math.random() * 700;
  setTimeout(() => {
    removeTyping();
    addMsg('b', reply);
    chipPhase = Math.min(chipPhase + 1, CHIPS.length - 1);
    renderChips(chipPhase);
    chatBusy = false;
  }, delay);
}

// ── Boot ───────────────────────────────────────────────────────────────────
function init() {
  renderEditorial(currentStage);
  renderChips(0);

  // Persona card
  document.getElementById('card-active').addEventListener('click', () => go('s2'));
  document.getElementById('card-active').addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') go('s2');
  });

  // Editorial nav
  document.getElementById('ed-back').addEventListener('click', () => go('s1'));
  document.getElementById('talk-btn').addEventListener('click', () => go('s3'));

  // Orientation nav
  document.getElementById('ori-back').addEventListener('click', () => go('s2'));
  document.getElementById('ori-cta').addEventListener('click', () => go('s4'));

  // Chat nav + send
  document.getElementById('chat-back').addEventListener('click', () => go('s3'));
  document.getElementById('snd-btn').addEventListener('click', sendFromInput);
  document.getElementById('inp').addEventListener('keydown', e => {
    if (e.key === 'Enter') sendFromInput();
  });
}

function sendFromInput() {
  const inp = document.getElementById('inp');
  const val = inp.value.trim();
  if (!val || chatBusy) return;
  inp.value = '';
  handleMessage(val);
}

init();
