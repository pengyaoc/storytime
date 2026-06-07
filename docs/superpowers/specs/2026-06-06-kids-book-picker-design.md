# Kids Book Picker — Design Spec

**Date:** 2026-06-06  
**Status:** Approved

---

## Problem

Children currently need a direct `/reader/{book_id}` URL to open a book. There is no way for a child to browse and pick which book to read independently.

---

## Goal

Add a `/reader` landing page where children can see all available books and tap one to start reading.

---

## Architecture

### Routing

| URL | Serves |
|---|---|
| `GET /reader` | `frontend/picker.html` (new) |
| `GET /reader/{book_id}` | `frontend/reader.html` (unchanged) |

One new route added to `main.py` (or `backend/routes.py`). No new API endpoints — the picker reuses the existing `GET /api/books`.

### New files

- `frontend/picker.html` — kids book picker page
- `frontend/picker.js` — fetches books, renders grid, handles tap navigation

### Unchanged files

- `frontend/reader.html`
- `frontend/reader.js`
- All backend logic

---

## UI Design

### Page structure

- **Background:** one of the 6 pastel colors from the reader, randomly chosen on load (`#ffd6d6`, `#c8f5e0`, `#c8e8ff`, `#ffefc8`, `#e8c8ff`, `#fff8f0`)
- **Font:** Nunito (700/800/900), same Google Fonts import as reader
- **Max-width:** 960px, centered, full-bleed background

### Header

- Sticky, floats above grid as user scrolls
- Background: gradient fade from pastel color to transparent (same as reader scrims)
- Title: "Storytime" — Nunito 900, `clamp(28px, 8vw, 42px)`, warm dark color
- Subtitle: "Pick a book to read!" — Nunito 700, muted

### Book grid

- CSS grid, responsive columns:
  - 2 columns: `< 560px`
  - 3 columns: `≥ 560px`
  - 4 columns: `≥ 780px`
- Gap: 16px (20px at 4-col)
- Padding: 8px 20px 36px

### Book card

- White background, `border-radius: 20px`
- Box shadow: `0 6px 24px rgba(90,60,20,0.13)`
- **Cover image:** first page image (`uploads/{book_id}/page_001.*`), `aspect-ratio: 3/4`, `object-fit: cover`, fills top of card
- **Title:** Nunito 800, `clamp(13px, 3.5vw, 17px)`, centered, 11–13px padding
- **Tap target:** entire card; navigates to `/reader/{book_id}`

### Interactions

- **Hover:** card lifts (`translateY(-5px) scale(1.025)`) with deeper shadow — CSS transition 180ms cubic-bezier bounce
- **Active/tap:** card presses down (`scale(0.96)`) — 80ms
- **Entrance:** staggered pop-in animation per card (scale + translateY, 380ms, 70ms delay between cards)

### States

| State | Behavior |
|---|---|
| Loading | Cards render as pastel placeholder rectangles (matching background palette) with a subtle pulse animation |
| Empty | Centered message: "No books yet. Ask a grown-up to add some!" — Nunito 700, muted color |
| Error | Centered message: "Couldn't load books. Try again." with a retry button |

### Cover image fallback

If `page_001` image is missing or fails to load, the card shows a colored gradient placeholder (same palette as reader page backgrounds) with the book's first letter centered.

---

## Data Flow

1. `picker.js` on load → `fetch('/api/books')` → returns `{ items: [{id, title, pages: [{page_number, image_filename, ...}]}] }`
2. For each book, cover URL = `/uploads/{book_id}/{page_001_filename}`
3. Tap on card → `window.location = '/reader/{book_id}'`
4. No state persisted — picker is stateless, re-fetches on each load

---

## Out of Scope

- Sorting or filtering books
- "Recently read" or progress indicators
- Search
- Any admin actions from the picker (no delete/edit)
