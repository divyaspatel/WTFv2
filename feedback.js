// feedback.js — shared "Was this helpful?" widget.
// One implementation used by both the chatbot (dock + full-screen) and the
// editorial "journey steps" tabs, so the UI/UX can't drift between surfaces.

const THUMB_UP   = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M9.5 2L6.5 8v6H12l2-6H9.5V2Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><rect x="2.5" y="8" width="3" height="6" rx=".5" stroke="currentColor" stroke-width="1.3"/></svg>`;
const THUMB_DOWN = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="transform:rotate(180deg)"><path d="M9.5 2L6.5 8v6H12l2-6H9.5V2Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><rect x="2.5" y="8" width="3" height="6" rx=".5" stroke="currentColor" stroke-width="1.3"/></svg>`;

// onSubmit(verdict, text) is called once, when the user clicks Submit.
export function createFeedbackWidget({ onSubmit }) {
  const el = document.createElement('div');
  el.className = 'fbw';
  el.innerHTML = `
    <div class="fbw-row">
      <span class="fbw-lbl">Was this helpful?</span>
      <button class="fbw-btn up" type="button" aria-label="Helpful">${THUMB_UP}</button>
      <button class="fbw-btn dn" type="button" aria-label="Not helpful">${THUMB_DOWN}</button>
    </div>
    <div class="fbw-form" hidden>
      <textarea class="fbw-txt" rows="2" maxlength="280"></textarea>
      <div class="fbw-acts">
        <button class="fbw-submit" type="button">Submit</button>
      </div>
    </div>
  `;

  const upBtn = el.querySelector('.fbw-btn.up');
  const dnBtn = el.querySelector('.fbw-btn.dn');
  const form  = el.querySelector('.fbw-form');
  const txt   = el.querySelector('.fbw-txt');
  const submitBtn = el.querySelector('.fbw-submit');
  let verdict = null;

  function selectVerdict(v) {
    verdict = v;
    upBtn.classList.toggle('selected', v === 'up');
    dnBtn.classList.toggle('selected', v === 'down');
    txt.placeholder = v === 'up' ? 'What was helpful (optional)?' : 'What would be more useful (optional)?';
    form.removeAttribute('hidden');
    txt.focus();
  }

  function submit() {
    onSubmit(verdict, txt.value.trim());
    el.innerHTML = '<span class="fbw-thanks">Thanks for the feedback.</span>';
  }

  upBtn.addEventListener('click', () => selectVerdict('up'));
  dnBtn.addEventListener('click', () => selectVerdict('down'));
  submitBtn.addEventListener('click', submit);

  return el;
}
