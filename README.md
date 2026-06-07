# Storytime

Digitize your physical picture books and have them read aloud to your kids — in **your own voice**.

Storytime lets parents upload photos of book pages, automatically transcribe the text via OCR, record a short voice sample, and generate audio for every page using local AI voice cloning. Kids get a tap-to-play, swipe-to-turn reading experience on any device.

Everything runs locally on your Mac. No cloud, no subscriptions, no data leaving your home.

---

## Requirements

- **Mac with Apple Silicon** (M1 or later) — required for both OCR and the voice model
- **macOS 13 Ventura or later**
- **Python 3.12+**
- **~4 GB free disk** for the Qwen3-TTS voice model (downloaded once on first use, cached in `~/.cache/huggingface`)

---

## Installation

**1. Clone the repo**

```bash
git clone https://github.com/your-username/storytime.git
cd storytime
```

**2. Create a virtual environment and install dependencies**

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**3. Start the server**

```bash
python main.py
```

The server starts at `http://localhost:8000`. Open it in any browser on your Mac.

> The first time you generate audio, the Qwen3-TTS model (~4 GB) will download automatically. This takes a few minutes depending on your connection. Subsequent runs use the cached model.

---

## Usage

### Parent setup (do this once per book)

1. Go to **`http://localhost:8000/parent`**
2. Click **+ New Book** and enter a title
3. Drag your book page photos into the dropzone — OCR runs automatically on each page. Review and correct any text.
4. Click **Manage voices…** to create a voice profile:
   - Record yourself reading any sentence (3–10 seconds), save as a WAV/MP3/M4A file
   - Upload the clip and type its exact transcript
   - Give the profile a name (e.g. "Mom")
5. Select the voice profile from the book's dropdown
6. Click **Generate All Audio** — each page is processed and shown as ready when done
7. Copy the reader link and bookmark it on your child's tablet

### Child reading

Open `http://localhost:8000` (or the direct book link) on any device on your home network.

- Tap the **▶ button** to hear the page read aloud
- Tap the **arrows** or **swipe** to turn pages
- Enable **Auto-play** to have the book read itself all the way through

---

## Accessing from other devices (tablets, phones)

The server binds to `0.0.0.0:8000`, so any device on your local network can reach it.

Find your Mac's local IP address:

```bash
ipconfig getifaddr en0
```

Then open `http://<your-mac-ip>:8000` on the child's device and bookmark it.

---

## Project structure

```
storytime/
├── main.py              # FastAPI app, route definitions
├── requirements.txt
├── backend/
│   ├── routes.py        # API endpoints
│   ├── books.py         # Book/page data (JSON files)
│   ├── ocr.py           # Apple Vision OCR
│   ├── tts.py           # Voice cloning via mlx-audio
│   ├── preferences.py   # Voice profile storage
│   └── models.py        # MLX model lifecycle
└── frontend/
    ├── picker.html       # Book selection screen (child)
    ├── picker.js
    ├── reader.html       # Reading screen (child)
    ├── reader.js
    ├── index.html        # Parent portal (/parent)
    └── admin.js
```

Data created at runtime (excluded from git):

| Directory | Contents |
|---|---|
| `books/` | Book metadata JSON files |
| `uploads/` | Uploaded page images |
| `audio_output/` | Generated WAV files |
| `voice_clips/` | Reference audio clips and voice profile config |

---

## How it works

- **OCR** — Apple Vision Framework (`VNRecognizeTextRequest`) runs on-device, no API key needed. Supports English, Simplified Chinese, Traditional Chinese, and more.
- **Voice cloning** — [mlx-audio](https://github.com/Blaizzy/mlx-audio) runs Qwen3-TTS locally on Apple Silicon via MLX. A 3–10 second reference clip is enough to clone a voice.
- **Storage** — No database. Books are JSON files; media is stored as flat files.
- **Server** — FastAPI + Uvicorn. Audio generation streams progress page-by-page via NDJSON.

---

## Limitations

- macOS + Apple Silicon only (Vision Framework and MLX are Apple-specific)
- No authentication — designed for trusted home network use only
- One audio generation job at a time (MLX runs single-threaded)
- No in-app voice recording; record externally and upload the clip

---

## License

MIT
