import { CHANGELOG } from './changelog_data.js';

const list = document.getElementById('entry-list');

CHANGELOG.forEach((entry, i) => {
  const card = document.createElement('div');
  card.className = 'entry';

  const blogRow = entry.blogUrl
    ? `<a href="${entry.blogUrl}" class="blog-link" target="_blank" rel="noopener">
        Read the full post
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M2 9L9 2M9 2H4M9 2V7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </a>`
    : `<span class="blog-coming-soon">Coming soon</span>`;

  card.innerHTML = `
    <button class="entry-trigger" aria-expanded="false" data-index="${i}">
      <div class="entry-trigger-text">
        <div class="entry-date">Shipped ${entry.date}</div>
        <div class="entry-title">${entry.title}</div>
      </div>
      <svg class="entry-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 5.5L8 10.5L13 5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <div class="entry-body">
      <div class="user-section">
        <div class="section-label">What changed for you</div>
        <p class="entry-summary">${entry.userSummary}</p>
        <ul class="entry-bullets">
          ${entry.userBullets.map(b => `<li>${b}</li>`).join('')}
        </ul>
        <div class="blog-link-row">${blogRow}</div>
      </div>

      <div class="builders-section">
        <button class="builders-trigger" aria-expanded="false">
          <span class="builders-label">Builder's note</span>
          <svg class="builders-chevron" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2.5 5L7 9.5L11.5 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="builders-body">${entry.buildersNote}</div>
      </div>
    </div>
  `;

  card.querySelector('.entry-trigger').addEventListener('click', () => {
    const isOpen = card.classList.toggle('open');
    card.querySelector('.entry-trigger').setAttribute('aria-expanded', isOpen);
  });

  card.querySelector('.builders-trigger').addEventListener('click', (e) => {
    e.stopPropagation();
    const section = card.querySelector('.builders-section');
    const isOpen = section.classList.toggle('open');
    card.querySelector('.builders-trigger').setAttribute('aria-expanded', isOpen);
  });

  list.appendChild(card);
});
