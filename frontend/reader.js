// ─── State ───────────────────────────────────────────────────────────────────
let book = null;
let pageIndex = 0;
let autoPlay = false;
let activePage = null;
let transitioning = false;
let autoPlayTimer = null;
const audio = new Audio();

const BG_CLASSES = ['bg-0','bg-1','bg-2','bg-3','bg-4','bg-5'];

// ─── Boot ─────────────────────────────────────────────────────────────────────
const bookId = location.pathname.replace(/\/$/, '').split('/').pop();

fetch(`/api/books/${bookId}`)
  .then(r => {
    if (!r.ok) throw new Error('Book not found');
    return r.json();
  })
  .then(data => {
    book = data;
    document.title = book.title || 'Storytime';
    document.getElementById('loading-screen').style.display = 'none';
    renderFirst();
    bindEvents();
  })
  .catch(() => {
    document.getElementById('loading-screen').textContent = 'Book not found.';
  });

// ─── Render ───────────────────────────────────────────────────────────────────
function buildPageEl(index) {
  const page = book.pages[index];
  const bgClass = BG_CLASSES[index % BG_CLASSES.length];
  const hasAudio = page.audio_status === 'ready' && page.audio_filename;

  const el = document.createElement('div');
  el.className = `page-slot ${bgClass}`;
  el.dataset.index = index;

  // Book cover image
  if (page.image_filename) {
    const img = document.createElement('img');
    img.className = 'page-img';
    img.src = `/uploads/${bookId}/${page.image_filename}`;
    img.alt = `Page ${page.page_number}`;
    el.appendChild(img);
  }

  // Top scrim + title
  el.innerHTML += `
    <div class="top-scrim">
      <div class="book-title">${escHtml(book.title)}</div>
    </div>
  `;

  // Bottom panel
  const playDisabled = hasAudio ? '' : 'disabled';
  const dotsHtml = book.pages.map((_, i) =>
    `<div class="dot ${i === index ? 'active' : ''}"></div>`
  ).join('');

  const panel = document.createElement('div');
  panel.className = 'bottom-panel';
  panel.innerHTML = `
    <div class="page-text">${escHtml(page.text)}</div>
    <button class="play-btn" id="play-btn" ${playDisabled} aria-label="Play">
      ${playIcon()}
    </button>
    <div class="dots">${dotsHtml}</div>
    <div class="autoplay-row">
      <button class="toggle ${autoPlay ? 'on' : ''}" id="autoplay-toggle" aria-label="Auto-play"></button>
      <span class="autoplay-label">Auto-play</span>
    </div>
  `;
  el.appendChild(panel);

  return el;
}

function renderFirst() {
  activePage = buildPageEl(pageIndex);
  document.getElementById('stage').appendChild(activePage);
  bindPageEvents(activePage);
  updateArrows();
  document.body.className = BG_CLASSES[pageIndex % BG_CLASSES.length];
}

function updateArrows() {
  const prev = document.getElementById('prev-btn');
  const next = document.getElementById('next-btn');
  prev.classList.toggle('hidden-arrow', pageIndex === 0);
  next.classList.toggle('hidden-arrow', pageIndex === book.pages.length - 1);
}

// ─── Slide transition ─────────────────────────────────────────────────────────
function slideTo(newIndex, direction) {
  if (transitioning) return;
  if (newIndex < 0 || newIndex >= book.pages.length) return;

  transitioning = true;
  clearTimeout(autoPlayTimer);
  audio.pause();
  audio.src = '';
  updatePlayBtn(false);

  const incoming = buildPageEl(newIndex);
  incoming.style.transform = direction === 'next' ? 'translateX(100%)' : 'translateX(-100%)';
  document.getElementById('stage').appendChild(incoming);

  // Double rAF to force layout before transition starts
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const ease = 'transform 300ms cubic-bezier(0.4,0,0.2,1)';
      incoming.style.transition = ease;
      activePage.style.transition = ease;
      incoming.style.transform = 'translateX(0)';
      activePage.style.transform = direction === 'next' ? 'translateX(-100%)' : 'translateX(100%)';

      incoming.addEventListener('transitionend', () => {
        activePage.remove();
        activePage = incoming;
        pageIndex = newIndex;
        transitioning = false;
        bindPageEvents(activePage);
        updateArrows();
        document.body.className = BG_CLASSES[pageIndex % BG_CLASSES.length];

        if (autoPlay) {
          const page = book.pages[pageIndex];
          if (page.audio_status === 'ready' && page.audio_filename) {
            playCurrentPage();
          } else if (pageIndex < book.pages.length - 1) {
            autoPlayTimer = setTimeout(() => slideTo(pageIndex + 1, 'next'), 5000);
          }
        }
      }, { once: true });
    });
  });
}

// ─── Audio ────────────────────────────────────────────────────────────────────
function playCurrentPage() {
  const page = book.pages[pageIndex];
  if (!page || page.audio_status !== 'ready' || !page.audio_filename) return;
  audio.src = `/audio/${page.audio_filename}`;
  audio.play();
  updatePlayBtn(true);
}

function togglePlay() {
  if (audio.paused) {
    if (!audio.src || audio.ended) {
      playCurrentPage();
    } else {
      audio.play();
      updatePlayBtn(true);
    }
  } else {
    audio.pause();
    updatePlayBtn(false);
  }
}

function updatePlayBtn(playing) {
  const btn = activePage?.querySelector('#play-btn');
  if (!btn) return;
  btn.classList.toggle('playing', playing);
  btn.classList.toggle('pause-state', playing);
  btn.innerHTML = playing ? pauseIcon() : playIcon();
}

audio.addEventListener('ended', () => {
  updatePlayBtn(false);
  if (autoPlay && pageIndex < book.pages.length - 1) {
    setTimeout(() => slideTo(pageIndex + 1, 'next'), 600);
  }
});

audio.addEventListener('play', () => updatePlayBtn(true));
audio.addEventListener('pause', () => updatePlayBtn(false));

// ─── Event binding ────────────────────────────────────────────────────────────
function bindPageEvents(el) {
  const playBtn = el.querySelector('#play-btn');
  if (playBtn) playBtn.addEventListener('click', togglePlay);

  const toggle = el.querySelector('#autoplay-toggle');
  if (toggle) toggle.addEventListener('click', () => {
    autoPlay = !autoPlay;
    toggle.classList.toggle('on', autoPlay);
    if (!autoPlay) clearTimeout(autoPlayTimer);
  });
}

function bindEvents() {
  document.getElementById('prev-btn').addEventListener('click', () => slideTo(pageIndex - 1, 'prev'));
  document.getElementById('next-btn').addEventListener('click', () => slideTo(pageIndex + 1, 'next'));

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft')  slideTo(pageIndex - 1, 'prev');
    if (e.key === 'ArrowRight') slideTo(pageIndex + 1, 'next');
    if (e.key === ' ') { e.preventDefault(); togglePlay(); }
  });

  // Touch swipe
  let touchStartX = 0;
  document.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) {
      dx < 0 ? slideTo(pageIndex + 1, 'next') : slideTo(pageIndex - 1, 'prev');
    }
  }, { passive: true });
}

// ─── SVG icons ────────────────────────────────────────────────────────────────
function playIcon() {
  return `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
}
function pauseIcon() {
  return `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
