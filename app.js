import { initDockChat, setDockChips } from './chat.js';

// ── Supabase config (anon key is public) ──────────────────────────────────────
const SUPABASE_URL = 'https://agsxcnxfsawplkieochk.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnc3hjbnhmc2F3cGxraWVvY2hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MTA5NDUsImV4cCI6MjA4NzE4Njk0NX0.PGQMJv7fdRraBhatDIWp3s6qnksLxxDmPVsxr1bSOuw';

// ── Session ID for feedback telemetry ─────────────────────────────────────────
const SESSION_ID = (() => {
  let id = sessionStorage.getItem('wtf_session');
  if (!id) { id = crypto.randomUUID(); sessionStorage.setItem('wtf_session', id); }
  return id;
})();

// ── Milestone data (stub content — real content from Supabase pipeline later) ─
const MILESTONES = [
  {
    id: 'prep',
    label: 'PREP',
    name: 'Prep',
    description: 'What to do before your first cycle.',
    questions: [
      'What should I ask at my first consultation?',
      'What does AMH actually tell me, and is mine good?',
      'How do I evaluate and compare clinics?',
      'What does insurance typically cover — and what doesn\'t it?',
      'Should I make lifestyle changes before starting?',
      'What bloodwork will I need done first?',
      'What\'s the difference between egg freezing and embryo freezing?',
      'How do I know if I need PGT-A?',
    ],
    wisdom: [
      { quote: 'I wish I had asked about the clinic\'s lab quality, not just success rates. The lab makes all the difference in fertilization outcomes.', count: 312 },
      { quote: 'Get your bloodwork done before your first consult so you can actually have a real conversation. Don\'t go in blind.', count: 187 },
      { quote: 'I consulted three clinics before choosing. The pricing and protocols were completely different — it was worth the extra time.', count: 241 },
      { quote: 'The first appointment felt overwhelming. I made a list of questions the night before and it helped enormously.', count: 156 },
    ],
    resources: [
      { title: 'SART Success Rates by Clinic', desc: 'Official fertility clinic outcome data by location' },
      { title: 'Understanding AMH & AFC', desc: 'What your baseline numbers mean and their limits' },
      { title: 'Insurance coverage checklist', desc: 'Questions to ask your plan administrator before you start' },
    ],
    chips: ['Right clinic?', 'Before first consult?', 'AMH numbers?', 'Insurance?', 'Cost out of pocket?'],
  },
  {
    id: 'meds',
    label: 'MEDS',
    name: 'Meds',
    description: 'Stims, triggers, and what your body actually does.',
    questions: [
      'How painful are the injections really?',
      'What side effects should I actually expect vs. worry about?',
      'How do I store and travel with medications?',
      'What happens if I miss a dose?',
      'What is the trigger shot and why does timing matter?',
      'What\'s OHSS and how do I know if I have it?',
    ],
    wisdom: [
      { quote: 'The first injection is the scariest. By day three, it\'s just part of the routine.', count: 428 },
      { quote: 'Ice the spot first. Nobody told me this and it made such a difference.', count: 356 },
      { quote: 'Bloating got bad around day 7–8. I bought a size up in pants. Plan for it.', count: 203 },
      { quote: 'The emotional swings from hormones are real. I cried at a coffee commercial on day 5.', count: 178 },
    ],
    resources: [
      { title: 'Injection technique video guides', desc: 'Step-by-step walkthroughs for common stim meds' },
      { title: 'OHSS symptoms — when to call', desc: 'What\'s normal bloating vs. when to contact your clinic' },
      { title: 'Medication storage guide', desc: 'Refrigeration and travel tips by drug type' },
    ],
    chips: ['Injection pain?', 'Side effects?', 'Storing meds?', 'Missed dose?'],
  },
  {
    id: 'retrieval',
    label: 'RETR',
    name: 'Retrieval',
    description: 'The procedure day, recovery, and the wait for numbers.',
    questions: [
      'What actually happens during the retrieval procedure?',
      'How long is recovery and what do I need to plan for?',
      'What should I bring on the day?',
      'When will I find out how many eggs were retrieved?',
      'What\'s a good number of eggs and what affects it?',
      'Is it normal to feel emotional after retrieval?',
    ],
    wisdom: [
      { quote: 'I was more emotional than I expected after retrieval. Even with good numbers. Hormones + relief + the wait = a lot.', count: 267 },
      { quote: 'The procedure itself was fine — I was sedated. Mild cramping the day after. Back to work day 2.', count: 391 },
      { quote: 'Don\'t check social media in the waiting room before. Just don\'t.', count: 178 },
      { quote: 'Have food ready at home. Something warm and easy. You won\'t want to think about it afterward.', count: 142 },
    ],
    resources: [
      { title: 'What to expect on retrieval day', desc: 'Hour-by-hour timeline from r/eggfreezing' },
      { title: 'Understanding your egg numbers', desc: 'Maturity rates, attrition, and what the numbers mean' },
      { title: 'Recovery checklist', desc: 'What to prep at home before your retrieval day' },
    ],
    chips: ['Day of procedure?', 'Recovery time?', 'What to bring?', 'Wait for results?'],
  },
  {
    id: 'embryo',
    label: 'EMBR',
    name: 'Embryo',
    description: 'If and when you fertilize — fresh vs. frozen decisions.',
    questions: [
      'Should I fertilize my eggs now or keep them frozen?',
      'What\'s a normal fertilization rate?',
      'What\'s the difference between Day 3 and Day 5 embryos?',
      'What does "blastocyst" mean and why does it matter?',
      'How does having a partner or donor affect this decision?',
    ],
    wisdom: [
      { quote: 'I went back to fertilize after 2 years. The process was much simpler than the retrieval. No regrets about waiting.', count: 142 },
      { quote: 'My RE explained day 5 blastocysts have better implantation rates. We waited the extra two days and I\'m glad we did.', count: 219 },
      { quote: 'Not everyone fertilizes right away and that\'s totally valid. This is about preserving options, not making decisions.', count: 187 },
    ],
    resources: [
      { title: 'Egg vs. embryo freezing comparison', desc: 'Survival rates, outcomes, and decision factors' },
      { title: 'Embryo development stages', desc: 'From fertilization to blastocyst — what happens when' },
      { title: 'Sperm donor basics', desc: 'Timing, logistics, and what to know upfront' },
    ],
    chips: ['Fresh vs frozen?', 'Fertilization rates?', 'Day 3 vs day 5?'],
  },
  {
    id: 'pgta',
    label: 'PGT-A',
    name: 'PGT-A',
    description: 'Genetic testing — what it tells you, what it doesn\'t.',
    questions: [
      'Is PGT-A worth the extra cost?',
      'What does the test actually check for?',
      'What happens if all my embryos come back abnormal?',
      'What are mosaic results and what do they mean?',
      'Does PGT-A improve success rates or just sort outcomes?',
    ],
    wisdom: [
      { quote: 'I did PGT-A and it was brutal to see the results. But knowing helped me not do a transfer that wouldn\'t have worked.', count: 203 },
      { quote: 'My RE said it\'s most valuable for women over 35. Under 35 with good blast counts, it\'s more of a personal call.', count: 168 },
      { quote: 'Mosaic results sent me into a spiral. I wish someone had told me upfront that mosaic isn\'t a no.', count: 134 },
    ],
    resources: [
      { title: 'PGT-A explained in plain language', desc: 'What the test screens for and how to interpret results' },
      { title: 'Mosaic embryo outcomes', desc: 'What community members learned from their RE conversations' },
      { title: 'Cost-benefit guide for PGT-A', desc: 'When it adds value vs. when the community said to skip it' },
    ],
    chips: ['Worth the cost?', 'What if all abnormal?', 'Mosaic results?'],
  },
  {
    id: 'next',
    label: 'NEXT',
    name: 'Next',
    description: 'Storage, future cycles, and what to plan for now.',
    questions: [
      'How much does annual storage cost and how does billing work?',
      'What happens to my eggs if I move or switch clinics?',
      'When should I think about doing another retrieval cycle?',
      'How long can frozen eggs or embryos actually be stored?',
      'What do I need to do to check in on my frozen eggs?',
    ],
    wisdom: [
      { quote: 'Storage is usually around $500–700/year. Set a calendar reminder so you never miss a payment. Losing eggs to non-payment happens.', count: 312 },
      { quote: 'I transferred clinics when I moved cities. It was a process — start it early. Takes 4–8 weeks sometimes.', count: 156 },
      { quote: 'I did a second cycle two years later. Felt way less anxious the second time — I knew the whole process.', count: 198 },
    ],
    resources: [
      { title: 'Clinic transfer logistics guide', desc: 'How to move frozen eggs between facilities' },
      { title: 'Storage contract questions checklist', desc: 'What to ask before you sign the storage agreement' },
      { title: 'When to consider a second cycle', desc: 'What numbers and circumstances women cite as their trigger' },
    ],
    chips: ['Storage costs?', 'When to use?', 'Future cycles?'],
  },
];

// ── State ─────────────────────────────────────────────────────────────────────
let currentMilestone = 'prep';
let dockExpanded = false;

// ── Navigation ────────────────────────────────────────────────────────────────
function go(id) {
  document.querySelectorAll('.scr').forEach(s => s.classList.remove('on'));
  document.getElementById(id).classList.add('on');
}

// ── Milestone strip ───────────────────────────────────────────────────────────
function renderStrip() {
  const strip = document.getElementById('ms-strip');
  strip.innerHTML = MILESTONES.map((m, i) => `
    ${i > 0 ? '<div class="ms-arr">→</div>' : ''}
    <div class="ms-pill${m.id === currentMilestone ? ' active' : ''}" data-milestone="${m.id}">
      <div class="ms-pill-lbl">${m.label}</div>
      <div class="ms-pill-here">you are here</div>
    </div>
  `).join('');
}

// ── SVG helpers ───────────────────────────────────────────────────────────────
const CARET_DOWN = `<svg width="12" height="7" viewBox="0 0 12 7" fill="none"><path d="M1 1L6 6L11 1" stroke="var(--lt)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const CARET_UP   = `<svg width="12" height="7" viewBox="0 0 12 7" fill="none"><path d="M1 6L6 1L11 6" stroke="var(--lt)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const THUMB_UP   = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M9.5 2L6.5 8v6H12l2-6H9.5V2Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><rect x="2.5" y="8" width="3" height="6" rx=".5" stroke="currentColor" stroke-width="1.3"/></svg>`;
const THUMB_DOWN = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" style="transform:rotate(180deg)"><path d="M9.5 2L6.5 8v6H12l2-6H9.5V2Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><rect x="2.5" y="8" width="3" height="6" rx=".5" stroke="currentColor" stroke-width="1.3"/></svg>`;

// ── Milestone panel ───────────────────────────────────────────────────────────
function renderMilestone(milestoneId) {
  currentMilestone = milestoneId;
  renderStrip();
  setDockChips(MILESTONES.find(m => m.id === milestoneId)?.chips || []);

  const m = MILESTONES.find(m => m.id === milestoneId);
  if (!m) return;

  const idx = MILESTONES.indexOf(m);
  const isFirst = idx === 0;

  const savedChecks = JSON.parse(localStorage.getItem(`wtf_q_${milestoneId}`) || '[]');

  // Questions section
  const allQs = m.questions;
  const visibleQs = allQs.slice(0, 4);
  const hiddenQs = allQs.slice(4);

  const qItem = (q, i) => `
    <label class="q-item">
      <input type="checkbox" class="q-chk" data-milestone="${milestoneId}" data-idx="${i}" ${savedChecks[i] ? 'checked' : ''}>
      <span class="q-txt">${q}</span>
    </label>`;

  const questionsHtml = `
    <div class="q-list">
      ${visibleQs.map((q, i) => qItem(q, i)).join('')}
      ${hiddenQs.length ? `
        <div class="q-hidden">${hiddenQs.map((q, i) => qItem(q, i + 4)).join('')}</div>
        <button class="acc-more" data-type="q">+ ${hiddenQs.length} more questions</button>
      ` : ''}
    </div>`;

  // Wisdom section
  const allW = m.wisdom;
  const visibleW = allW.slice(0, 3);
  const hiddenW = allW.slice(3);

  const wItem = (w) => `
    <div class="wisdom-item">
      <div class="wisdom-quote">"${w.quote}"</div>
      <div class="wisdom-count">mentioned by ${w.count.toLocaleString()} women</div>
    </div>`;

  const wisdomHtml = `
    <div class="wisdom-list">
      ${visibleW.map(wItem).join('')}
      ${hiddenW.length ? `
        <div class="wisdom-hidden">${hiddenW.map(wItem).join('')}</div>
        <button class="acc-more" data-type="w">+ ${hiddenW.length} more insights</button>
      ` : ''}
    </div>`;

  // Resources section
  const resourcesHtml = `
    <div class="resource-list">
      ${m.resources.map(r => `
        <div class="resource-item">
          <div class="resource-title">${r.title}</div>
          <div class="resource-desc">${r.desc}</div>
        </div>`).join('')}
    </div>`;

  const fbRow = (section) => `
    <div class="acc-fb" data-milestone="${milestoneId}" data-section="${section}">
      <span class="acc-fb-lbl">Was this helpful?</span>
      <div class="acc-fb-btns">
        <button class="fb-btn up" title="Yes, helpful">${THUMB_UP}</button>
        <button class="fb-btn dn" title="Not helpful">${THUMB_DOWN}</button>
      </div>
    </div>
    <div class="fb-form" hidden>
      <textarea class="fb-txt" rows="2" placeholder="What's working?"></textarea>
      <div class="fb-acts">
        <button class="fb-skip">Skip</button>
        <button class="fb-submit">Submit</button>
      </div>
    </div>`;

  const accSection = (section, title, info, bodyHtml, defaultOpen) => `
    <div class="acc${defaultOpen ? ' open' : ''}" data-section="${section}">
      <div class="acc-hdr">
        <div class="acc-meta">
          <div class="acc-title">${title}</div>
          <div class="acc-info">${info}</div>
        </div>
        <div class="acc-toggle">${CARET_DOWN}</div>
      </div>
      <div class="acc-body">
        ${bodyHtml}
        ${fbRow(section)}
      </div>
    </div>`;

  document.getElementById('ms-panel').innerHTML = `
    <div class="ms-card">
      <div class="ms-card-hdr">
        <div class="ms-milestone-label${isFirst ? '' : ' inactive'}">
          ${isFirst ? 'Milestone 1 · You are here' : `Milestone ${idx + 1}`}
        </div>
        <div class="ms-milestone-name">${m.name}</div>
        <div class="ms-milestone-desc">${m.description}</div>
      </div>
      ${accSection('questions',
        'Questions to ask your provider',
        `${allQs.length} questions, drawn from what women wish they'd asked`,
        questionsHtml,
        true
      )}
      ${accSection('wisdom',
        'What women wish they\'d known',
        `${allW.length} insights from the community`,
        wisdomHtml,
        false
      )}
      ${accSection('resources',
        'Resources for this stage',
        `${m.resources.length} articles, tools, and references`,
        resourcesHtml,
        false
      )}
    </div>`;
}

// ── Panel event delegation (wired once in init) ───────────────────────────────

function handlePanelClick(e) {
  // Accordion toggle
  const hdr = e.target.closest('.acc-hdr');
  if (hdr) {
    const acc = hdr.closest('.acc');
    acc.classList.toggle('open');
    return;
  }

  // Show more questions/wisdom
  const more = e.target.closest('.acc-more');
  if (more) {
    const hidden = more.previousElementSibling;
    if (hidden) hidden.style.display = 'block';
    more.remove();
    return;
  }

  // Feedback thumbs
  const fbBtn = e.target.closest('.fb-btn');
  if (fbBtn) {
    const accFb = fbBtn.closest('.acc-fb');
    const fbForm = accFb.nextElementSibling;
    const isUp = fbBtn.classList.contains('up');

    accFb.querySelectorAll('.fb-btn').forEach(b => b.classList.remove('selected'));
    fbBtn.classList.add('selected');
    fbForm.removeAttribute('hidden');
    fbForm.querySelector('.fb-txt').placeholder = isUp ? 'What\'s working?' : 'What could be better?';
    fbForm.dataset.verdict = isUp ? 'up' : 'down';
    fbForm.querySelector('.fb-txt').focus();
    return;
  }

  // Feedback submit
  if (e.target.classList.contains('fb-submit')) {
    const fbForm = e.target.closest('.fb-form');
    const accFb = fbForm.previousElementSibling;
    const text = fbForm.querySelector('.fb-txt').value.trim();
    logFeedback({
      milestone: accFb.dataset.milestone,
      section: accFb.dataset.section,
      verdict: fbForm.dataset.verdict,
      text,
    });
    showThanks(accFb, fbForm);
    return;
  }

  // Feedback skip
  if (e.target.classList.contains('fb-skip')) {
    const fbForm = e.target.closest('.fb-form');
    const accFb = fbForm.previousElementSibling;
    logFeedback({
      milestone: accFb.dataset.milestone,
      section: accFb.dataset.section,
      verdict: fbForm.dataset.verdict,
      text: null,
    });
    showThanks(accFb, fbForm);
    return;
  }
}

function handlePanelChange(e) {
  if (!e.target.classList.contains('q-chk')) return;
  const milestoneId = e.target.dataset.milestone;
  const checks = [...document.querySelectorAll(`.q-chk[data-milestone="${milestoneId}"]`)]
    .map(c => c.checked);
  localStorage.setItem(`wtf_q_${milestoneId}`, JSON.stringify(checks));
}

function showThanks(accFb, fbForm) {
  fbForm.setAttribute('hidden', '');
  const thanks = document.createElement('div');
  thanks.className = 'fb-thanks';
  thanks.textContent = 'Thanks for the feedback.';
  accFb.replaceWith(thanks);
}

// ── Feedback telemetry ────────────────────────────────────────────────────────
// Requires a `feedback_events` table in Supabase with columns:
//   id, user_session_id, screen, milestone, section, verdict, optional_text, created_at
async function logFeedback({ milestone, section, verdict, text }) {
  if (!verdict) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/feedback_events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
        'apikey': ANON_KEY,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        verdict,
        optional_text: text || null,
        milestone,
        section,
      }),
    });
  } catch { /* fail silently */ }
}

// ── Chat dock ─────────────────────────────────────────────────────────────────
function expandDock() {
  dockExpanded = true;
  document.getElementById('dock-panel').classList.add('open');
  document.getElementById('jn-overlay').classList.add('show');
  document.getElementById('dock-pill').style.visibility = 'hidden';
  document.getElementById('dock-inp').focus();
}

function collapseDock() {
  dockExpanded = false;
  document.getElementById('dock-panel').classList.remove('open');
  document.getElementById('jn-overlay').classList.remove('show');
  document.getElementById('dock-pill').style.visibility = '';
}

// ── Boot ──────────────────────────────────────────────────────────────────────
function init() {
  initDockChat('active');

  // Milestone panel — single delegated listener
  const panel = document.getElementById('ms-panel');
  panel.addEventListener('click', handlePanelClick);
  panel.addEventListener('change', handlePanelChange);

  // S0 → S1
  document.getElementById('s0-cta').addEventListener('click', () => go('s1'));

  // S1 → S2
  const card = document.getElementById('card-active');
  card.addEventListener('click', () => go('s2'));
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') go('s2'); });

  // S2 back → S1, CTA → S3
  document.getElementById('cb-back').addEventListener('click', () => go('s1'));
  document.getElementById('cb-cta').addEventListener('click', () => {
    go('s3');
    // Render initial milestone on first visit
    if (!document.getElementById('ms-panel').children.length) {
      renderMilestone('prep');
    }
  });

  // S3 back → S2
  document.getElementById('jn-back').addEventListener('click', () => {
    collapseDock();
    go('s2');
  });

  // Milestone strip clicks (event delegation)
  document.getElementById('ms-strip').addEventListener('click', e => {
    const pill = e.target.closest('.ms-pill');
    if (pill) renderMilestone(pill.dataset.milestone);
  });

  // Chat dock open/close
  document.getElementById('dock-pill').addEventListener('click', expandDock);
  document.getElementById('dock-close').addEventListener('click', collapseDock);
  document.getElementById('jn-overlay').addEventListener('click', collapseDock);
}

init();
