# Storytime — Product Requirements Document

**Version:** 1.0  
**Date:** 2026-06-06  
**Owner:** Pengyao Chen  
**Status:** Shipped (v1)

---

## Problem

Physical picture books can't be read aloud by a parent who isn't present. Existing audiobook apps use professional narrators — not the child's own family members. There is no simple way for a parent to record their voice once and have it play back across an entire digitized picture book.

---

## Goal

Enable parents to digitize physical picture books, clone their voice from a short recording, and give children an immersive, self-service reading experience that plays the book aloud in a familiar voice.

---

## Users

| User | Description |
|---|---|
| **Parent (setup)** | Uploads book photos, corrects OCR text, records voice sample, triggers audio generation. Technical comfort: moderate. Uses the admin UI on a desktop browser. |
| **Child (reader)** | Navigates and listens to books. Age 3–8. No reading required. Uses the reader UI on a tablet or phone. |

---

## Non-Goals

- Multi-user accounts or authentication
- Cloud sync or remote hosting
- Video or animated pages
- Text-to-speech with non-cloned voices
- In-app voice recording (parent records externally, uploads clip)
- Editing the book's page images after upload

---

## Features

### Admin UI

| # | Feature | Description |
|---|---|---|
| A1 | Book management | Create, rename, and delete books. Each book has a title, voice profile, and ordered list of pages. |
| A2 | Page upload | Drag-drop or file-picker upload of JPEG/PNG/WEBP images. Multiple files at once. Sequential upload with per-file status. |
| A3 | OCR | Automatic text extraction from each uploaded page image using Apple Vision Framework. Text is editable after extraction. |
| A4 | Voice profile setup | Upload a 3–10s reference audio clip and enter its exact transcript to create a named voice profile (e.g. "Mom", "Dad"). Multiple profiles supported. |
| A5 | Audio generation | Generate TTS audio for all pages (or individual pages) using the selected voice profile. Streaming progress via NDJSON — each page's status updates live. |
| A6 | Per-page audio preview | HTML5 audio player on each page card after audio is generated. |

### Reader UI

| # | Feature | Description |
|---|---|---|
| R1 | Full-bleed display | Book page image fills the entire screen. Per-page pastel background color shows on letterbox sides. |
| R2 | Page text | Displayed in large Nunito font over a white gradient scrim at the bottom of the screen. |
| R3 | Play button | 88px centered orange circle button. Active (orange) when audio is ready; grayed and disabled when not. Pulsing ring animation while playing. |
| R4 | Page navigation | Left/right arrow buttons (52px circles) centered vertically on screen edges. Hidden on first/last page. |
| R5 | Slide transition | CSS translateX slide animation (300ms) between pages. |
| R6 | Swipe support | Touch swipe left/right (50px threshold) triggers page navigation. |
| R7 | Keyboard support | ← / → arrows navigate pages. Space bar toggles play/pause. |
| R8 | Auto-play | Toggle switch. When on: after audio ends, 600ms delay, then auto-advance to next page and play. |
| R9 | Page dots | Row of dots showing current position in the book. |

---

## Technical Requirements

- Runs locally on macOS (Apple Silicon)
- No internet connection required after first model download
- Voice model: Qwen3-TTS via mlx-audio (local inference, ~4GB download on first use)
- OCR: Apple Vision Framework (built-in macOS, no download)
- Server: FastAPI + Uvicorn, port 8000
- No database — JSON files for book metadata, filesystem for media

---

## User Flows

### Parent Setup Flow

```
Open http://localhost:8000
  → Click "+ New Book" → enter title
  → Drag book photos into dropzone
    → Each photo: save → OCR → display text (editable)
  → Click "Manage voices…"
    → Upload reference clip (3–10s of parent reading aloud)
    → Enter exact transcript → Save Profile
  → Select voice profile from dropdown
  → Click "Generate All Audio"
    → Each page: generating → ready (live badge updates)
  → Click "Open reader ↗" → share URL with child
```

### Child Reading Flow

```
Open /reader/{book_id} (e.g. bookmarked on tablet)
  → See page 1 image + text
  → Tap ▶ → audio plays in parent's cloned voice
  → Tap › arrow (or swipe) → slide to page 2
  → [Optional] Enable Auto-play → book reads itself through
```

---

## Success Metrics

- Time from first photo upload to playable book < 10 minutes (excluding model download)
- OCR accuracy on printed picture book text > 90% without manual correction
- Audio generation time < 10 seconds per page on Apple Silicon
- Child can operate reader UI without parent assistance

---

## Constraints

- macOS only (Apple Vision Framework, MLX)
- Requires Python 3.12+
- ~4GB disk for Qwen3-TTS model (one-time download, cached in `~/.cache/huggingface`)
- No concurrent audio generation (MLX is single-threaded; pages generated sequentially)
