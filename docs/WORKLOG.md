# Storytime — Worklog

---

## 2026-06-06 — Initial Build

### Planning

- Explored sibling repo `voice-studio` to understand the voice cloning stack (FastAPI + Qwen3-TTS via mlx-audio, vanilla JS frontend, local JSON persistence)
- Identified 5 backend files to copy verbatim: `tts.py`, `models.py`, `mlx_backend.py`, `audio_utils.py`, `preferences.py`, `history.py`
- Ran brainstorming session (visual companion) to finalize key design decisions:
  - **OCR**: Apple Vision Framework (`pyobjc-framework-Vision`) — macOS-native, no API key, no model download, handles picture book font variety
  - **Reader layout**: Full-bleed illustration, white gradient scrim at bottom, page text above centered play button
  - **Page transitions**: CSS translateX slide (300ms, double-rAF pattern)
  - **Admin UI**: Utilitarian two-column, no decorative elements
- Wrote implementation plan to local plans directory

### Backend

**`backend/books.py`** — Thread-safe book CRUD. Per-book `threading.Lock`, atomic JSON writes via `.tmp + os.replace()`. Operations: list, get, create, update, delete book; add, update, delete page with contiguous re-numbering.

**`backend/ocr.py`** — Apple Vision Framework OCR. Wraps `VNRecognizeTextRequest` at `VNRequestTextRecognitionLevelAccurate` with language correction enabled. Called via `asyncio.to_thread` from async routes.

**`backend/routes.py`** — All API endpoints:
  - Book/page CRUD (GET/POST/PATCH/DELETE)
  - Page upload: multipart → save image → OCR → append to book JSON
  - Audio generation: NDJSON streaming, sequential per-page, `generate_voice_clone` via `asyncio.to_thread`, atomic file move from flat `audio_output/` to `audio_output/{book_id}/page_NNN.wav`
  - Voice profile endpoints ported from voice-studio

**`main.py`** — FastAPI app. Critical ordering: `/reader/{book_id}` route registered before `StaticFiles` mount to prevent the catch-all from intercepting reader URLs.

### Frontend — Admin

**`frontend/index.html`** — Two-column layout (280px sidebar + main). Tailwind via CDN. Modals for new book and voice profile management.

**`frontend/admin.js`** — Book list, page upload (sequential per-file with spinner), OCR text display in editable textarea, debounced PATCH on text edits (600ms), NDJSON stream consumption for live badge updates during audio generation, voice profile create/delete flow.

### Frontend — Reader

**`frontend/reader.html`** — Full-viewport CSS layout. Nunito font (Google Fonts CDN). Per-page pastel background cycle (6 colors). Bottom gradient panel.

**`frontend/reader.js`** — Two-slot slide transition (double-rAF + CSS transition + `transitionend` cleanup). Touch swipe (50px threshold). Keyboard (←/→/Space). Auto-play with 600ms inter-page delay. Play button toggles orange/gray based on `audio_status`.

### Bugs Found & Fixed During Testing

| Bug | Root Cause | Fix |
|---|---|---|
| Reader stuck on "Loading book…" | `reader.html` uses relative `src="reader.js"`, which resolved to `/reader/reader.js` — hitting the FastAPI `/reader/{book_id}` catch-all route and returning HTML instead of JS | Changed to absolute path `src="/reader.js"` |
| Port 8000 conflict on startup | Another Python process (voice-studio) was already bound to 8000 | Killed existing process before starting |
| `reader.js` SyntaxError in browser | Consequence of above — browser parsed HTML as JavaScript | Resolved by the path fix above |

### Dependencies Installed

```
fastapi==0.115.12
uvicorn[standard]==0.34.2
python-multipart==0.0.20
mlx-audio==0.4.4          # includes mlx-lm, transformers, safetensors
soundfile>=0.13.1
pyobjc-framework-Vision>=10.0
pyobjc-framework-Quartz>=10.0
pillow>=10.0.0
```

### End-to-End Test Results

| Step | Result |
|---|---|
| Server startup (`uvicorn main:app`) | ✅ |
| Admin UI loads at `http://localhost:8000` | ✅ |
| Create book via API + UI | ✅ |
| Upload page images (2 pages) | ✅ |
| OCR text extraction | ✅ (returns empty for photos without text; correct for printed text) |
| Manual text edit via admin | ✅ |
| Voice profile creation (clip upload + transcript) | ✅ |
| Audio generation for page 1 (3.6s WAV) | ✅ |
| Reader loads at `/reader/{book_id}` | ✅ (after fixing relative script path) |
| Full-bleed image with `object-fit: contain` | ✅ |
| Play button active (orange) when audio ready | ✅ |
| Slide to page 2 | ✅ |
| Page dot updates | ✅ |
| Auto-play toggle visible | ✅ |

### Model Notes

- Qwen3-TTS (`mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16`) auto-downloaded on first `generate_voice_clone` call
- ~4GB download, cached at `~/.cache/huggingface/hub`
- Generation time for a short sentence (~50 chars): ~30–60s on first call (model load), ~5–10s on subsequent calls (model stays in memory)
- Output: 24kHz mono WAV

---

## Outstanding / Next Steps

- [ ] Test OCR on real picture book photos (printed text, varied fonts)
- [ ] Test audio quality with English text + Chinese reference clip (cross-lingual cloning)
- [ ] Add page reordering in admin (drag to reorder)
- [ ] Add book cover / thumbnail for the reader landing page
- [ ] Consider a simple book selection screen at `/` for kids (vs. direct URL)
- [ ] Mobile viewport polish (test on actual iPad)
- [ ] Add `mlx-audio` model warm-up on server start (avoid cold-start delay on first generation)
