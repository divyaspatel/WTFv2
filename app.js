import { EDITORIAL } from './editorial_content.js';
import { initChat } from './chat.js';

// ── State ─────────────────────────────────────────────────────────────────────
let currentStage = 'active';

// ── Navigation ────────────────────────────────────────────────────────────────
function go(id) {
  document.querySelectorAll('.scr').forEach(s => s.classList.remove('on'));
  document.getElementById(id).classList.add('on');
  if (id === 's4') {
    setTimeout(() => {
      const msgs = document.getElementById('msgs');
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }, 50);
  }
}

// ── Editorial rendering ───────────────────────────────────────────────────────
function renderEditorial(stage) {
  const d = EDITORIAL[stage];
  if (!d) return;

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

  document.getElementById('edScroll').innerHTML = `
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

// ── Boot ──────────────────────────────────────────────────────────────────────
function init() {
  renderEditorial(currentStage);
  initChat(currentStage);

  // S1: persona card
  const card = document.getElementById('card-active');
  card.addEventListener('click', () => go('s2'));
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') go('s2');
  });

  // S2: editorial nav
  document.getElementById('ed-back').addEventListener('click', () => go('s1'));
  document.getElementById('talk-btn').addEventListener('click', () => go('s3'));

  // S3: orientation nav
  document.getElementById('ori-back').addEventListener('click', () => go('s2'));
  document.getElementById('ori-cta').addEventListener('click', () => go('s4'));

  // S4: chat back
  document.getElementById('chat-back').addEventListener('click', () => go('s3'));
}

init();
