import { createChatSurface } from './chat.js';

// ── Supabase config (anon key is public) ──────────────────────────────────────
const SUPABASE_URL = 'https://agsxcnxfsawplkieochk.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnc3hjbnhmc2F3cGxraWVvY2hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MTA5NDUsImV4cCI6MjA4NzE4Njk0NX0.PGQMJv7fdRraBhatDIWp3s6qnksLxxDmPVsxr1bSOuw';

// ── Session ID for feedback telemetry ─────────────────────────────────────────
const SESSION_ID = (() => {
  let id = sessionStorage.getItem('wtf_session');
  if (!id) { id = crypto.randomUUID(); sessionStorage.setItem('wtf_session', id); }
  return id;
})();

// ── Milestone data (static fallback — overwritten by loadMilestoneInsights) ───
const MILESTONES = [
  {
    id: 'testing',
    dbId: 'initial_testing',
    label: 'TEST',
    name: 'Initial Fertility Testing',
    description: 'Baseline bloodwork and scans that show where you\'re starting from.',
    questions: [
      'What does AMH actually tell me, and is mine good?',
      'What is an antral follicle count and why does it matter?',
      'What bloodwork will I need before my first consult?',
      'My AMH came back low — what does that actually mean for me?',
      'What\'s the difference between FSH, AMH, and AFC?',
      'How do I prepare for baseline testing?',
    ],
    wisdom: [
      { quote: 'Get your bloodwork done before your first consult so you can actually have a real conversation. Don\'t go in blind.', count: 187 },
      { quote: 'AMH is a snapshot, not a sentence. Mine was low and I still got 9 eggs. Ask what it means for your specific protocol.', count: 263 },
      { quote: 'I was so fixated on my AMH number that I missed what my AFC was telling me. Both matter.', count: 144 },
      { quote: 'Numbers vary between labs. If something looks off, get it rechecked before you spiral.', count: 198 },
    ],
    resources: [
      { title: 'Understanding AMH & AFC', desc: 'What your baseline numbers mean and their limits' },
      { title: 'Day 3 bloodwork guide', desc: 'What gets tested, when, and how to read the results' },
      { title: 'Low AMH — community experiences', desc: 'What women with low AMH actually got from retrieval' },
    ],
    chips: ['AMH numbers?', 'Low AMH?', 'What to test first?', 'AFC explained?'],
  },
  {
    id: 'consult',
    dbId: 're_consult',
    label: 'CONS',
    name: 'RE Consultation',
    description: 'Choosing a clinic, meeting your RE, and understanding your protocol.',
    questions: [
      'What should I ask at my first consultation?',
      'How do I evaluate and compare clinics?',
      'What does insurance typically cover — and what doesn\'t it?',
      'What\'s the difference between egg freezing and embryo freezing?',
      'How do I know if I need PGT-A before I even start?',
      'Should I get a second opinion?',
    ],
    wisdom: [
      { quote: 'I consulted three clinics before choosing. The pricing and protocols were completely different — it was worth the extra time.', count: 241 },
      { quote: 'I wish I had asked about the clinic\'s lab quality, not just success rates. The lab makes all the difference in fertilization outcomes.', count: 312 },
      { quote: 'The first appointment felt overwhelming. I made a list of questions the night before and it helped enormously.', count: 156 },
      { quote: 'Ask what their cancellation rate is. Some clinics cancel cycles more than others when follicle counts are low.', count: 179 },
    ],
    resources: [
      { title: 'SART Success Rates by Clinic', desc: 'Official fertility clinic outcome data by location' },
      { title: 'Insurance coverage checklist', desc: 'Questions to ask your plan administrator before you start' },
      { title: 'First consult question list', desc: 'Community-sourced questions organized by topic' },
    ],
    chips: ['Right clinic?', 'Questions to ask?', 'Insurance?', 'Cost out of pocket?', 'Second opinion?'],
  },
  {
    id: 'stims',
    dbId: 'stim_start',
    label: 'STIM',
    name: 'Stim Start',
    description: 'Beginning injections and what the first days of stimulation feel like.',
    questions: [
      'How painful are the injections really?',
      'What side effects should I actually expect vs. worry about?',
      'How do I store and travel with medications?',
      'What happens if I miss a dose?',
      'What is the trigger shot and why does timing matter so much?',
      'What\'s OHSS and how do I know if I have it?',
    ],
    wisdom: [
      { quote: 'The first injection is the scariest. By day three, it\'s just part of the routine.', count: 428 },
      { quote: 'Ice the spot first. Nobody told me this and it made such a difference.', count: 356 },
      { quote: 'The emotional swings from hormones are real. I cried at a coffee commercial on day 5.', count: 178 },
      { quote: 'Set alarms for your injection times. Consistency matters more than people let on.', count: 211 },
    ],
    resources: [
      { title: 'Injection technique video guides', desc: 'Step-by-step walkthroughs for common stim meds' },
      { title: 'OHSS symptoms — when to call', desc: 'What\'s normal bloating vs. when to contact your clinic' },
      { title: 'Medication storage guide', desc: 'Refrigeration and travel tips by drug type' },
    ],
    chips: ['Injection pain?', 'Side effects?', 'Storing meds?', 'Missed dose?', 'OHSS?'],
  },
  {
    id: 'monitoring',
    dbId: 'monitoring',
    label: 'MONT',
    name: 'Monitoring',
    description: 'Frequent ultrasounds and bloodwork to track follicle growth.',
    questions: [
      'How many monitoring appointments should I expect?',
      'What are they looking for at each ultrasound?',
      'What do my estrogen levels tell my doctor?',
      'When does the clinic decide to trigger?',
      'What happens if my follicles aren\'t growing evenly?',
      'Can I work out during monitoring?',
    ],
    wisdom: [
      { quote: 'Plan for early morning monitoring appointments — most clinics do them before 9am. It affects your whole schedule.', count: 302 },
      { quote: 'I had 6 monitoring appointments over 10 days. Some cycles are shorter, some longer. Don\'t read into the timing too much.', count: 189 },
      { quote: 'My lead follicle was way ahead of the others. I was convinced it was a bad sign. It wasn\'t. Don\'t google individual follicle sizes.', count: 247 },
      { quote: 'The waiting between appointments is its own kind of hard. I tried to keep my schedule normal so I wasn\'t obsessing.', count: 163 },
    ],
    resources: [
      { title: 'What follicle sizes mean', desc: 'Community breakdown of monitoring milestones by day' },
      { title: 'Estrogen levels during stims', desc: 'What the numbers track and what triggers concern' },
      { title: 'Trigger timing explained', desc: 'How clinics decide when to pull the trigger' },
    ],
    chips: ['How many appointments?', 'Follicle sizes?', 'E2 levels?', 'When to trigger?'],
  },
  {
    id: 'retrieval',
    dbId: 'trigger_retrieval',
    label: 'RETR',
    name: 'Trigger & Retrieval',
    description: 'The trigger shot, procedure day, and immediate recovery.',
    questions: [
      'What actually happens during the retrieval procedure?',
      'How long is recovery and what do I need to plan for?',
      'What should I bring on the day?',
      'When will I find out how many eggs were retrieved?',
      'What\'s a good number of eggs and what affects it?',
      'Is it normal to feel emotional after retrieval?',
    ],
    wisdom: [
      { quote: 'The procedure itself was fine — I was sedated. Mild cramping the day after. Back to work day 2.', count: 391 },
      { quote: 'I was more emotional than I expected after retrieval. Even with good numbers. Hormones + relief + the wait = a lot.', count: 267 },
      { quote: 'Have food ready at home. Something warm and easy. You won\'t want to think about it afterward.', count: 142 },
      { quote: 'Don\'t check social media in the waiting room before. Just don\'t.', count: 178 },
    ],
    resources: [
      { title: 'What to expect on retrieval day', desc: 'Hour-by-hour timeline from r/eggfreezing' },
      { title: 'Understanding your egg numbers', desc: 'Maturity rates, attrition, and what the numbers mean' },
      { title: 'Recovery checklist', desc: 'What to prep at home before your retrieval day' },
    ],
    chips: ['Day of procedure?', 'Recovery time?', 'What to bring?', 'How many eggs?'],
  },
  {
    id: 'eggsfrozen',
    dbId: 'eggs_frozen',
    label: 'EGGS',
    name: 'Eggs Frozen',
    description: 'Your final egg count, what maturity means, and storage next steps.',
    questions: [
      'How many mature eggs do I actually need?',
      'What\'s the difference between retrieved and mature eggs?',
      'What does the attrition rate look like from retrieval to storage?',
      'Should I do another cycle to get more eggs?',
      'How long can frozen eggs be stored?',
      'What does storage cost and how does billing work?',
    ],
    wisdom: [
      { quote: 'I retrieved 14 eggs, 10 were mature, 8 survived the freeze. That attrition is totally normal — I wish I had known to expect it.', count: 334 },
      { quote: 'Storage is usually around $500–700/year. Set a calendar reminder so you never miss a payment. Losing eggs to non-payment happens.', count: 312 },
      { quote: 'I did a second cycle because 6 felt low for my age. My RE helped me think through the numbers before deciding.', count: 221 },
      { quote: 'The number you end up with isn\'t a grade. It\'s a starting point.', count: 189 },
    ],
    resources: [
      { title: 'Egg survival and attrition rates', desc: 'What percentage makes it from retrieval to freeze' },
      { title: 'How many eggs is enough?', desc: 'Community data by age bracket and intended use' },
      { title: 'Storage contract questions checklist', desc: 'What to ask before you sign the storage agreement' },
    ],
    chips: ['Mature egg count?', 'Attrition rates?', 'Do another cycle?', 'Storage costs?'],
  },
  {
    id: 'fertilization',
    dbId: 'fertilization',
    label: 'FERT',
    name: 'Fertilization',
    description: 'Deciding to fertilize, ICSI vs. conventional IVF, and the first call.',
    questions: [
      'Should I fertilize my eggs now or keep them frozen?',
      'What\'s the difference between ICSI and conventional IVF?',
      'What\'s a normal fertilization rate?',
      'How does having a partner or donor affect this decision?',
      'What happens if none of my eggs fertilize?',
    ],
    wisdom: [
      { quote: 'I went back to fertilize after 2 years. The process was much simpler than the retrieval. No regrets about waiting.', count: 142 },
      { quote: 'Not everyone fertilizes right away and that\'s totally valid. This is about preserving options, not making decisions.', count: 187 },
      { quote: 'My clinic recommended ICSI even though my partner\'s numbers were fine. Worth asking why your clinic is recommending it.', count: 203 },
      { quote: 'The fertilization call the next morning was the most anxious I\'ve been in this whole process.', count: 256 },
    ],
    resources: [
      { title: 'ICSI vs. conventional IVF', desc: 'When each is used and what the community experienced' },
      { title: 'Egg vs. embryo freezing comparison', desc: 'Survival rates, outcomes, and decision factors' },
      { title: 'Sperm donor basics', desc: 'Timing, logistics, and what to know upfront' },
    ],
    chips: ['ICSI vs IVF?', 'Fertilize now?', 'Normal fert rate?', 'Using donor sperm?'],
  },
  {
    id: 'embryodev',
    dbId: 'embryo_development',
    label: 'EMBR',
    name: 'Embryo Development',
    description: 'Day 3 to Day 7 — watching embryos grow and what the updates mean.',
    questions: [
      'What\'s the difference between Day 3 and Day 5 embryos?',
      'What does "blastocyst" mean and why does it matter?',
      'What happens between fertilization and Day 5?',
      'Is it bad if an embryo is still growing on Day 6 or 7?',
      'What grades do embryos get and how do I read them?',
      'How many embryos usually make it to blast?',
    ],
    wisdom: [
      { quote: 'My RE explained day 5 blastocysts have better implantation rates. We waited the extra two days and I\'m glad we did.', count: 219 },
      { quote: 'I had 4 fertilize and only 1 made it to blast. The drop-off between fertilization and Day 5 is brutal but normal.', count: 287 },
      { quote: 'A Day 6 or 7 blast isn\'t a failure — a lot of women got successful transfers from late blasts.', count: 174 },
      { quote: 'The embryo grading system made me obsess. Try to remember that grades are imperfect predictors.', count: 193 },
    ],
    resources: [
      { title: 'Embryo development stages', desc: 'From fertilization to blastocyst — what happens when' },
      { title: 'Embryo grading explained', desc: 'What the letter and number grades actually mean' },
      { title: 'Day 5 vs. Day 6 vs. Day 7 blasts', desc: 'Community outcomes by development timing' },
    ],
    chips: ['Day 3 vs day 5?', 'Blast grades?', 'Day 6 or 7?', 'How many make it?'],
  },
  {
    id: 'pgta',
    dbId: 'pgta',
    label: 'PGTA',
    name: 'PGT-A',
    description: 'Genetic testing — what it tells you, what it doesn\'t, and what mosaic means.',
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
      { quote: 'PGT-A doesn\'t make embryos better — it just tells you which ones to transfer first. Know what you\'re buying.', count: 211 },
    ],
    resources: [
      { title: 'PGT-A explained in plain language', desc: 'What the test screens for and how to interpret results' },
      { title: 'Mosaic embryo outcomes', desc: 'What community members learned from their RE conversations' },
      { title: 'Cost-benefit guide for PGT-A', desc: 'When it adds value vs. when the community said to skip it' },
    ],
    chips: ['Worth the cost?', 'What if all abnormal?', 'Mosaic results?', 'Skip PGT-A?'],
  },
  {
    id: 'embryosfrozen',
    dbId: 'embryos_frozen',
    label: 'DONE',
    name: 'Embryos Frozen',
    description: 'Your final embryo count, storage, and planning what comes next.',
    questions: [
      'How many euploid embryos do I actually need?',
      'What happens to my embryos if I move or switch clinics?',
      'When should I think about doing another retrieval cycle?',
      'How long can frozen embryos actually be stored?',
      'What\'s a frozen embryo transfer (FET) and when does that happen?',
      'What do I need to do to check in on my frozen embryos?',
    ],
    wisdom: [
      { quote: 'One euploid embryo is not one baby. It\'s one chance. I wish someone had framed it that way earlier.', count: 298 },
      { quote: 'I transferred clinics when I moved cities. It was a process — start it early. Takes 4–8 weeks sometimes.', count: 156 },
      { quote: 'I did a second cycle two years later. Felt way less anxious the second time — I knew the whole process.', count: 198 },
      { quote: 'Having embryos in storage felt like relief and pressure at the same time. Both feelings make sense.', count: 167 },
    ],
    resources: [
      { title: 'FET basics — what to expect', desc: 'What a frozen embryo transfer cycle looks like' },
      { title: 'Clinic transfer logistics guide', desc: 'How to move frozen embryos between facilities' },
      { title: 'When to consider a second cycle', desc: 'What numbers and circumstances women cite as their trigger' },
    ],
    chips: ['How many embryos?', 'FET timeline?', 'Storage costs?', 'Another cycle?'],
  },
];

// ── Load milestone insights from Supabase ─────────────────────────────────────
async function loadMilestoneInsights() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/milestone_insights?select=id,questions,wisdom,resources`,
      { headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` } }
    );
    if (!res.ok) return;
    const rows = await res.json();
    const byId = Object.fromEntries(rows.map(r => [r.id, r]));
    MILESTONES.forEach(m => {
      const row = byId[m.dbId];
      if (!row) return;
      if (row.questions?.length)  m.questions  = row.questions;
      if (row.wisdom?.length)     m.wisdom     = row.wisdom.map(w => ({ quote: w.quote, count: w.source_count }));
      if (row.resources?.length)  m.resources  = row.resources.map(r => ({ title: r.title, desc: r.description }));
    });
  } catch { /* fall back to static data */ }
}

// ── State ─────────────────────────────────────────────────────────────────────
let viewStageId = 'testing';
let currentTab = 'questions';
let dockExpanded = false;

// ── Chat surfaces ─────────────────────────────────────────────────────────────
const dockChat = createChatSurface({
  ids: { msgs: 'dock-msgs', empty: 'dock-empty', chips: 'dock-chips', input: 'dock-inp', send: 'dock-snd' },
  getMilestone: () => viewStageId,
});

const mainChat = createChatSurface({
  ids: { msgs: 'ch-msgs', empty: 'ch-empty', chips: 'ch-chips', input: 'ch-inp', send: 'ch-snd' },
  getMilestone: () => null,
});

const STARTER_CHIPS = [
  'Where do I even start?',
  'How painful are the injections?',
  'What does it actually cost?',
];

// ── Navigation ────────────────────────────────────────────────────────────────
function go(id) {
  document.querySelectorAll('.scr').forEach(s => s.classList.remove('on'));
  document.getElementById(id).classList.add('on');
}

// ── SVG helpers ───────────────────────────────────────────────────────────────
const THUMB_UP   = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M9.5 2L6.5 8v6H12l2-6H9.5V2Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><rect x="2.5" y="8" width="3" height="6" rx=".5" stroke="currentColor" stroke-width="1.3"/></svg>`;
const THUMB_DOWN = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" style="transform:rotate(180deg)"><path d="M9.5 2L6.5 8v6H12l2-6H9.5V2Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><rect x="2.5" y="8" width="3" height="6" rx=".5" stroke="currentColor" stroke-width="1.3"/></svg>`;

// ── Journey list ──────────────────────────────────────────────────────────────
function renderJourneyList() {
  const list = document.getElementById('jl-list');
  list.innerHTML = MILESTONES.map((m, i) => `
    <div class="jl-row" data-stage="${m.id}" role="button" tabindex="0">
      <div class="jl-num">${i + 1}</div>
      <div class="jl-bd">
        <div class="jl-name">${m.name}</div>
        <div class="jl-desc">${m.description}</div>
      </div>
      <span class="jl-arr">›</span>
    </div>
  `).join('');
}

// ── Stage detail ──────────────────────────────────────────────────────────────
function openDetail(stageId) {
  const m = MILESTONES.find(x => x.id === stageId);
  if (!m) return;
  viewStageId = stageId;
  currentTab = 'questions';
  document.getElementById('dt-crumb-name').textContent = m.name;
  document.getElementById('dt-title').textContent = m.name;
  document.getElementById('dt-desc').textContent = m.description;
  dockChat.setChips(m.chips || []);
  renderTabs();
  renderTabBody();
  collapseDock();
  go('s-detail');
}

function renderTabs() {
  document.querySelectorAll('#dt-tabs .dt-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === currentTab)
  );
}

const fbRow = (milestoneId, section) => `
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

function renderTabBody() {
  const m = MILESTONES.find(x => x.id === viewStageId);
  if (!m) return;

  let html = '';
  if (currentTab === 'questions') {
    html = `<div class="q-list">${m.questions.map(q => `
      <div class="q-row"><span class="q-dot">•</span><span class="q-txt">${q}</span></div>`).join('')}
    </div>`;
  } else if (currentTab === 'wisdom') {
    html = `<div class="wisdom-list">${m.wisdom.map(w => `
      <div class="wisdom-item">
        <div class="wisdom-quote">"${w.quote}"</div>
        <div class="wisdom-count">mentioned by ${w.count.toLocaleString()} women</div>
      </div>`).join('')}
    </div>`;
  } else {
    html = `<div class="resource-list">${m.resources.map(r => `
      <div class="resource-item">
        <div class="resource-title">${r.title}</div>
        <div class="resource-desc">${r.desc}</div>
      </div>`).join('')}
    </div>`;
  }

  document.getElementById('dt-body').innerHTML = html + fbRow(viewStageId, currentTab);
}

// ── Tab-content feedback (delegated) ──────────────────────────────────────────
function handleBodyClick(e) {
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

  if (e.target.classList.contains('fb-submit') || e.target.classList.contains('fb-skip')) {
    const fbForm = e.target.closest('.fb-form');
    const accFb = fbForm.previousElementSibling;
    const text = e.target.classList.contains('fb-submit')
      ? fbForm.querySelector('.fb-txt').value.trim()
      : null;
    logFeedback({
      milestone: accFb.dataset.milestone,
      section: accFb.dataset.section,
      verdict: fbForm.dataset.verdict,
      text,
    });
    showThanks(accFb, fbForm);
  }
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
        user_session_id: SESSION_ID,
        source: 'editorial',
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
  document.getElementById('dt-overlay').classList.add('show');
  document.getElementById('dock-pill').style.visibility = 'hidden';
  document.getElementById('dock-inp').focus();
}

function collapseDock() {
  dockExpanded = false;
  document.getElementById('dock-panel').classList.remove('open');
  document.getElementById('dt-overlay').classList.remove('show');
  document.getElementById('dock-pill').style.visibility = '';
}

// ── Boot ──────────────────────────────────────────────────────────────────────
function init() {
  loadMilestoneInsights();
  mainChat.setChips(STARTER_CHIPS);

  const activate = (el, fn) => {
    el.addEventListener('click', fn);
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
    });
  };

  // Landing → Home
  document.getElementById('s0-cta').addEventListener('click', () => go('s-home'));

  // Brand (top-left on every screen) → back to landing
  document.querySelectorAll('[data-brand]').forEach(el =>
    activate(el, () => { collapseDock(); go('s0'); })
  );

  // Home cards
  activate(document.getElementById('hm-journey'), () => {
    renderJourneyList();
    go('s-journey');
  });
  activate(document.getElementById('hm-chat'), () => go('s-chat'));

  // Journey list
  document.getElementById('jn-back').addEventListener('click', () => go('s-home'));
  document.getElementById('jl-list').addEventListener('click', e => {
    const row = e.target.closest('.jl-row');
    if (row) openDetail(row.dataset.stage);
  });
  document.getElementById('jl-list').addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const row = e.target.closest('.jl-row');
    if (row) { e.preventDefault(); openDetail(row.dataset.stage); }
  });

  // Stage detail
  document.getElementById('dt-back').addEventListener('click', () => {
    collapseDock();
    go('s-journey');
  });
  document.getElementById('dt-tabs').addEventListener('click', e => {
    const tab = e.target.closest('.dt-tab');
    if (!tab || tab.dataset.tab === currentTab) return;
    currentTab = tab.dataset.tab;
    renderTabs();
    renderTabBody();
  });
  const body = document.getElementById('dt-body');
  body.addEventListener('click', handleBodyClick);

  // Chat dock open/close
  document.getElementById('dock-pill').addEventListener('click', expandDock);
  document.getElementById('dock-close').addEventListener('click', collapseDock);
  document.getElementById('dt-overlay').addEventListener('click', collapseDock);

  // Full-screen chat
  document.getElementById('ch-back').addEventListener('click', () => go('s-home'));
}

init();
