# Storytime — Entity Relationship Diagram

Storage is filesystem-based. There is no relational database. This document describes the logical data model, file layout, and relationships between entities.

---

## Entities

### Book
Stored as `books/{book_id}.json`

| Field | Type | Description |
|---|---|---|
| `id` | string (12-char hex) | Unique identifier, UUID-derived |
| `title` | string | Display name of the book |
| `created_at` | ISO 8601 string | Creation timestamp |
| `voice_profile` | string | Name of the assigned VoiceProfile (`""` if none) |
| `pages` | Page[] | Ordered list of pages (embedded) |

### Page
Embedded array within Book. Not stored as a separate file.

| Field | Type | Description |
|---|---|---|
| `page_number` | integer | 1-indexed, contiguous, re-numbered on delete |
| `image_filename` | string | Filename within `uploads/{book_id}/` |
| `text` | string | OCR-extracted or manually entered page text |
| `audio_filename` | string | Relative path within `audio_output/` (`""` if none) |
| `audio_status` | enum | `none` \| `generating` \| `ready` \| `error` |

### VoiceProfile
Stored as entries in `voice_clips/preferences.json`

| Field | Type | Description |
|---|---|---|
| `id` | string (12-char hex) | Unique identifier |
| `name` | string | Display name (e.g. "Mom", "Dad") |
| `reference_clip` | string | Filename within `voice_clips/` |
| `ref_text` | string | Exact transcript of the reference clip |
| `created_at` | ISO 8601 string | |
| `updated_at` | ISO 8601 string | |

### ReferenceClip
Stored as audio files in `voice_clips/`

| Field | Type | Description |
|---|---|---|
| `filename` | string | e.g. `mom_voice.m4a` |
| `size` | integer | File size in bytes (derived at read time) |
| `modified_at` | float | Unix timestamp (derived at read time) |

### GeneratedAudio
Stored as WAV files in `audio_output/{book_id}/`

Not a persistent entity — derived from the Page record. File path is `audio_output/{book_id}/page_{NNN}.wav`.

---

## Relationships

```
Book ─────────────────────────────── VoiceProfile
│  voice_profile (name)  →  name        │
│                                       │
│  1 Book has 0..1 VoiceProfile         │
│  1 VoiceProfile used by 0..N Books    │
│                                       │
│                             VoiceProfile ── ReferenceClip
│                             reference_clip (filename) → filename
│                             1 VoiceProfile has 1 ReferenceClip
│                             1 ReferenceClip used by 0..N VoiceProfiles

Book ──── Page[]
│
│  1 Book has 0..N Pages (embedded, ordered by page_number)
│
Page ──── GeneratedAudio (0..1)
│  audio_filename → audio_output/{book_id}/page_{NNN}.wav
│  Present only when audio_status = "ready"

Page ──── Image (1)
│  image_filename → uploads/{book_id}/{filename}
│  Always present after upload
```

---

## File Layout

```
storytime/
├── books/
│   └── {book_id}.json              # One JSON file per Book
│
├── uploads/
│   └── {book_id}/
│       ├── page_001.jpg            # Page images (1-indexed)
│       ├── page_002.jpg
│       └── ...
│
├── audio_output/
│   └── {book_id}/
│       ├── page_001.wav            # Generated audio (24kHz mono WAV)
│       ├── page_002.wav
│       └── ...
│
└── voice_clips/
    ├── preferences.json            # All VoiceProfiles + selected_profile_id
    ├── mom_voice.m4a               # ReferenceClip audio files
    └── ...
```

---

## Concurrency Model

- Each book JSON file is protected by a per-book `threading.Lock` (lazy-created, stored in-process)
- `preferences.json` is protected by a single module-level `threading.Lock`
- All writes use atomic `tmp → os.replace()` to prevent partial writes on crash
- Audio generation is sequential (one page at a time) — MLX is single-threaded on Apple Silicon

---

## Key Constraints

- `page_number` is always contiguous starting at 1; re-numbered on deletion
- `voice_profile` on Book stores the profile **name** (not ID) — names must be unique within preferences.json
- `audio_filename` stores a path relative to `audio_output/` (e.g. `{book_id}/page_001.wav`)
- Image filenames follow the pattern `page_{NNN}.{ext}` where NNN is the page number at upload time
- Deleting a book removes its JSON file, `uploads/{book_id}/`, and `audio_output/{book_id}/` — VoiceProfiles are not affected
