# Kids Book Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/reader` landing page where children can browse all available books in a responsive card grid and tap one to open it.

**Architecture:** A new route `GET /reader` in `main.py` serves `picker.html`. `picker.js` fetches `/api/books`, renders a responsive 2–4 column grid of book cards (cover = first page image + title), and navigates to `/reader/{book_id}` on tap. No backend API changes needed.

**Tech Stack:** FastAPI (FileResponse route), vanilla JS (fetch + DOM), CSS Grid, Nunito font (Google Fonts)

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Modify | `main.py` | Add `GET /reader` route serving `picker.html` |
| Create | `frontend/picker.html` | Kids book picker page (HTML + styles) |
| Create | `frontend/picker.js` | Fetch books, render grid, handle navigation |
| Delete | `frontend/picker-preview.html` | Remove the mockup file |

---

### Task 1: Add `/reader` route to `main.py`

**Files:**
- Modify: `main.py:17-19`

The existing `GET /reader/{book_id}` route serves `reader.html`. We need `GET /reader` (no book ID) to serve `picker.html`. This route must be declared **before** the static mount so FastAPI matches it first.

- [ ] **Step 1: Add the route**

In `main.py`, add this route directly after the existing `reader_page` route (line 19), before the `app.mount` calls:

```python
@app.get("/reader")
async def picker_page():
    return FileResponse("frontend/picker.html")
```

The full relevant block should now look like:

```python
@app.get("/reader/{book_id}")
async def reader_page(book_id: str):
    return FileResponse("frontend/reader.html")


@app.get("/reader")
async def picker_page():
    return FileResponse("frontend/picker.html")


app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/audio", StaticFiles(directory="audio_output"), name="audio")
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
```

- [ ] **Step 2: Verify the server starts without error**

```bash
cd /path/to/storytime
python -m uvicorn main:app --port 8000
```

Expected: `Application startup complete.` with no errors. Stop with Ctrl-C.

- [ ] **Step 3: Commit**

```bash
git add main.py
git commit -m "feat: add GET /reader route for kids book picker"
```

---

### Task 2: Create `picker.html`

**Files:**
- Create: `frontend/picker.html`

Matches the reader's visual language: Nunito font, pastel backgrounds, warm colors. Responsive 2–4 column grid with sticky header.

- [ ] **Step 1: Create `frontend/picker.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>Storytime</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      min-height: 100dvh;
      font-family: 'Nunito', sans-serif;
      overscroll-behavior: none;
    }

    .header-wrap {
      position: sticky;
      top: 0;
      z-index: 10;
    }

    header {
      padding: 28px 24px 16px;
      text-align: center;
      pointer-events: none;
      max-width: 960px;
      margin: 0 auto;
    }

    .header-title {
      font-size: clamp(28px, 8vw, 42px);
      font-weight: 900;
      color: #5a3e28;
      text-shadow: 0 3px 0 rgba(255,255,255,0.5);
      letter-spacing: -0.5px;
    }

    .header-sub {
      font-size: clamp(13px, 3.5vw, 16px);
      font-weight: 700;
      color: #9a7a5a;
      margin-top: 2px;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      padding: 8px 20px 36px;
      max-width: 960px;
      margin: 0 auto;
    }

    @media (min-width: 560px) {
      .grid { grid-template-columns: repeat(3, 1fr); }
    }

    @media (min-width: 780px) {
      .grid { grid-template-columns: repeat(4, 1fr); gap: 20px; }
    }

    .book-card {
      background: white;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 6px 24px rgba(90,60,20,0.13), 0 2px 6px rgba(90,60,20,0.08);
      cursor: pointer;
      text-decoration: none;
      display: block;
      transform: translateY(0) scale(1);
      transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1),
                  box-shadow 0.18s ease;
      -webkit-tap-highlight-color: transparent;
      animation: pop-in 0.38s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }

    .book-card:hover {
      transform: translateY(-5px) scale(1.025);
      box-shadow: 0 16px 40px rgba(90,60,20,0.2), 0 4px 12px rgba(90,60,20,0.1);
    }

    .book-card:active {
      transform: scale(0.96);
      box-shadow: 0 3px 10px rgba(90,60,20,0.12);
      transition-duration: 0.08s;
    }

    .book-cover {
      width: 100%;
      aspect-ratio: 3/4;
      display: block;
      object-fit: cover;
    }

    /* Fallback cover when image is missing */
    .book-cover-fallback {
      width: 100%;
      aspect-ratio: 3/4;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Nunito', sans-serif;
      font-weight: 900;
      font-size: clamp(32px, 8vw, 56px);
      color: rgba(255,255,255,0.8);
    }

    .book-title {
      padding: 11px 12px 13px;
      font-size: clamp(13px, 3.5vw, 17px);
      font-weight: 800;
      color: #3a2c1a;
      text-align: center;
      line-height: 1.3;
    }

    /* Placeholder skeleton card shown while loading */
    .book-card-skeleton {
      border-radius: 20px;
      overflow: hidden;
      animation: skeleton-pulse 1.4s ease-in-out infinite;
    }

    .skeleton-cover {
      width: 100%;
      aspect-ratio: 3/4;
    }

    .skeleton-title {
      height: 44px;
    }

    @keyframes skeleton-pulse {
      0%, 100% { opacity: 0.55; }
      50% { opacity: 0.85; }
    }

    .empty-state, .error-state {
      grid-column: 1 / -1;
      text-align: center;
      padding: 60px 24px;
      font-size: clamp(16px, 4vw, 20px);
      font-weight: 700;
      line-height: 1.6;
    }

    .error-state button {
      margin-top: 16px;
      padding: 10px 24px;
      border-radius: 24px;
      border: none;
      cursor: pointer;
      font-family: 'Nunito', sans-serif;
      font-size: 15px;
      font-weight: 800;
      background: rgba(90,60,20,0.15);
      color: #5a3e28;
    }

    @keyframes pop-in {
      0%   { opacity: 0; transform: scale(0.85) translateY(16px); }
      100% { opacity: 1; transform: scale(1) translateY(0); }
    }
  </style>
</head>
<body>
  <div class="header-wrap" id="header-wrap">
    <header>
      <div class="header-title">Storytime</div>
      <div class="header-sub">Pick a book to read!</div>
    </header>
  </div>

  <div class="grid" id="grid"></div>

  <script src="/picker.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/picker.html
git commit -m "feat: add picker.html for kids book picker"
```

---

### Task 3: Create `picker.js`

**Files:**
- Create: `frontend/picker.js`

Fetches `/api/books`, applies pastel background, renders skeleton cards while loading, then replaces with real cards. Each card is an `<a>` tag linking to `/reader/{book_id}`. Handles empty and error states. Staggered pop-in animation via inline `animation-delay`.

The `/api/books` response shape (from `backend/books.py`):
```json
{
  "items": [
    {
      "id": "e1bfa6215d1b",
      "title": "Goodnight Moon",
      "pages": [
        { "page_number": 1, "image_filename": "page_001.jpg", "audio_status": "ready" }
      ]
    }
  ]
}
```

Cover image URL = `/uploads/{book_id}/{page.image_filename}` where `page` is the first item in `pages`.

Fallback cover background colors (cycle by index, same palette as reader):
```
['#ffd6d6', '#c8f5e0', '#c8e8ff', '#ffefc8', '#e8c8ff', '#fff8f0']
```

- [ ] **Step 1: Create `frontend/picker.js`**

```javascript
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

    const firstPage = book.pages && book.pages[0];
    const coverUrl = firstPage
      ? `/uploads/${book.id}/${firstPage.image_filename}`
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
```

- [ ] **Step 2: Start the server and open `http://localhost:8000/reader` in a browser**

```bash
cd /path/to/storytime
python -m uvicorn main:app --reload --port 8000
```

Verify:
- Page loads with pastel background
- Books appear as cards with cover images and titles
- Tapping a card navigates to `/reader/{book_id}` and the book opens correctly
- Resizing the window switches between 2/3/4 columns at the right breakpoints
- With no books, the empty state message appears

- [ ] **Step 3: Commit**

```bash
git add frontend/picker.js
git commit -m "feat: add picker.js — fetch books and render responsive card grid"
```

---

### Task 4: Cleanup

**Files:**
- Delete: `frontend/picker-preview.html`

- [ ] **Step 1: Delete the mockup file**

```bash
git rm frontend/picker-preview.html
git commit -m "chore: remove picker mockup file"
```
