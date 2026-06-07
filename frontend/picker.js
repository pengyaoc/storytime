const BG_COLORS = ['#ffd6d6', '#c8f5e0', '#c8e8ff', '#ffefc8', '#e8c8ff', '#fff8f0'];

function applyBackground() {
  const bg = BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)];
  document.body.style.background = bg;
  document.getElementById('header-wrap').style.background =
    `linear-gradient(to bottom, ${bg} 70%, transparent 100%)`;
}

function renderSkeletons(count, bg) {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const card = document.createElement('div');
    card.className = 'book-card-skeleton';
    card.innerHTML = `
      <div class="skeleton-cover" style="background:${bg}"></div>
      <div class="skeleton-title" style="background:${bg}"></div>
    `;
    grid.appendChild(card);
  }
}

function renderBooks(books) {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';

  if (books.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="color:#9a7a5a">
        No books yet.<br>Ask a grown-up to add some!
      </div>`;
    return;
  }

  books.forEach((book, i) => {
    const card = document.createElement('a');
    card.className = 'book-card';
    card.href = `/reader/${book.id}`;
    card.style.animationDelay = `${i * 0.07}s`;

    const coverUrl = book.cover_image
      ? `/uploads/${book.id}/${book.cover_image}`
      : null;

    const fallbackBg = BG_COLORS[i % BG_COLORS.length];
    const firstLetter = (book.title || '?')[0].toUpperCase();

    if (coverUrl) {
      card.innerHTML = `
        <img class="book-cover"
             src="${coverUrl}"
             alt="${escapeAttr(book.title)}"
             onerror="this.replaceWith(makeFallback('${escapeAttr(firstLetter)}', '${fallbackBg}'))">
        <div class="book-title">${escapeHtml(book.title)}</div>`;
    } else {
      card.innerHTML = `
        <div class="book-cover-fallback" style="background:${fallbackBg}">${firstLetter}</div>
        <div class="book-title">${escapeHtml(book.title)}</div>`;
    }

    grid.appendChild(card);
  });
}

function renderError() {
  const grid = document.getElementById('grid');
  grid.innerHTML = `
    <div class="error-state" style="color:#9a7a5a">
      Couldn't load books. Try again.
      <br>
      <button onclick="loadBooks()">Retry</button>
    </div>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function makeFallback(letter, bg) {
  const el = document.createElement('div');
  el.className = 'book-cover-fallback';
  el.style.background = bg;
  el.textContent = letter;
  return el;
}

function loadBooks() {
  const bg = document.body.style.background || BG_COLORS[0];
  renderSkeletons(4, bg);

  fetch('/api/books')
    .then(r => {
      if (!r.ok) throw new Error('fetch failed');
      return r.json();
    })
    .then(data => renderBooks(data.items || []))
    .catch(() => renderError());
}

applyBackground();
loadBooks();
