import asyncio
import json
import os
import shutil

from PIL import Image
import pillow_heif
pillow_heif.register_heif_opener()

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import backend.books as books
from backend.audio_utils import AUDIO_OUTPUT_DIR, get_audio_duration
from backend.models import ModelSize
from backend.ocr import ocr_image_async
from backend.preferences import (
    create_clone_profile,
    delete_clone_profile,
    get_clone_preferences,
    get_clone_profiles_state,
    save_clone_preferences,
    select_clone_profile,
    update_clone_profile,
)
from backend.tts import generate_voice_clone

router = APIRouter()

VOICE_CLIPS_DIR = "voice_clips"
UPLOADS_DIR = "uploads"
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heic"}
ALLOWED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg", ".webm"}
LANGUAGES = [
    "Chinese", "English", "Japanese", "Korean", "German",
    "French", "Russian", "Portuguese", "Spanish", "Italian",
]


# ─── Pydantic models ────────────────────────────────────────────────────────

class CreateBookPayload(BaseModel):
    title: str


class UpdateBookPayload(BaseModel):
    title: str | None = None
    voice_profile: str | None = None


class UpdatePagePayload(BaseModel):
    text: str


class GenerateAudioPayload(BaseModel):
    page_numbers: list[int] = []
    language: str = "English"


class VoiceCloneProfilePayload(BaseModel):
    name: str = ""
    reference_clip: str = ""
    ref_text: str = ""


class VoiceCloneProfileSelectionPayload(BaseModel):
    selected_profile_id: str = ""


# ─── Helpers ────────────────────────────────────────────────────────────────

def _resolve_clip(filename: str) -> str:
    safe = os.path.basename(filename)
    if safe != filename:
        raise HTTPException(status_code=400, detail="Invalid reference clip name")
    path = os.path.join(VOICE_CLIPS_DIR, safe)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"Reference clip not found: {filename}")
    return path


def _serialize_clip(filename: str) -> dict:
    path = os.path.join(VOICE_CLIPS_DIR, filename)
    return {
        "filename": filename,
        "size": os.path.getsize(path),
        "modified_at": os.path.getmtime(path),
    }


def _save_clip(upload: UploadFile) -> dict:
    if not upload.filename:
        raise HTTPException(status_code=400, detail="Missing file name")
    filename = os.path.basename(upload.filename)
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported audio format: {ext}")
    os.makedirs(VOICE_CLIPS_DIR, exist_ok=True)
    dest = os.path.join(VOICE_CLIPS_DIR, filename)
    with open(dest, "wb") as f:
        shutil.copyfileobj(upload.file, f)
    return _serialize_clip(filename)


def _convert_heic_to_jpeg(path: str) -> str:
    """Convert a HEIC file to JPEG in-place, return new path."""
    jpeg_path = os.path.splitext(path)[0] + ".jpg"
    with Image.open(path) as img:
        img.convert("RGB").save(jpeg_path, "JPEG", quality=92)
    os.remove(path)
    return jpeg_path


def _ndjson(events):
    def generate():
        for event in events:
            yield json.dumps(event, ensure_ascii=True) + "\n"
    return StreamingResponse(generate(), media_type="application/x-ndjson")


# ─── Books ──────────────────────────────────────────────────────────────────

@router.get("/books")
async def list_books():
    return {"items": books.list_books()}


@router.post("/books", status_code=201)
async def create_book(payload: CreateBookPayload):
    return books.create_book(payload.title)


@router.get("/books/{book_id}")
async def get_book(book_id: str):
    try:
        return books.get_book(book_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Book not found")


@router.patch("/books/{book_id}")
async def update_book(book_id: str, payload: UpdateBookPayload):
    try:
        return books.update_book(book_id, title=payload.title, voice_profile=payload.voice_profile)
    except KeyError:
        raise HTTPException(status_code=404, detail="Book not found")


@router.delete("/books/{book_id}", status_code=204)
async def delete_book(book_id: str):
    try:
        books.delete_book(book_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Book not found")


# ─── Pages ──────────────────────────────────────────────────────────────────

@router.post("/books/{book_id}/pages", status_code=201)
async def upload_pages(book_id: str, files: list[UploadFile] = File(...)):
    try:
        books.get_book(book_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Book not found")

    added = []
    upload_dir = os.path.join(UPLOADS_DIR, book_id)
    os.makedirs(upload_dir, exist_ok=True)

    existing = books.get_book(book_id)
    next_num = len(existing["pages"]) + 1

    for upload in files:
        if not upload.filename:
            continue
        ext = os.path.splitext(upload.filename)[1].lower()
        if ext not in ALLOWED_IMAGE_EXTENSIONS:
            continue

        filename = f"page_{next_num:03d}{ext}"
        dest = os.path.join(upload_dir, filename)
        with open(dest, "wb") as f:
            shutil.copyfileobj(upload.file, f)

        if ext == ".heic":
            dest = _convert_heic_to_jpeg(dest)
            filename = os.path.basename(dest)

        try:
            text = await ocr_image_async(dest)
        except Exception:
            text = ""

        page = books.add_page(book_id, filename, text)
        added.append(page)
        next_num += 1

    return {"pages": added}


@router.patch("/books/{book_id}/pages/{page_number}")
async def update_page(book_id: str, page_number: int, payload: UpdatePagePayload):
    try:
        return books.update_page(book_id, page_number, text=payload.text)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/books/{book_id}/pages/{page_number}", status_code=204)
async def delete_page(book_id: str, page_number: int):
    try:
        books.delete_page(book_id, page_number)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ─── Audio generation ────────────────────────────────────────────────────────

@router.post("/books/{book_id}/generate-audio")
async def generate_book_audio(book_id: str, payload: GenerateAudioPayload):
    try:
        book = books.get_book(book_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Book not found")

    profile_name = book.get("voice_profile", "")
    if not profile_name:
        raise HTTPException(status_code=400, detail="No voice profile selected for this book")

    prefs = get_clone_preferences()
    profile = next(
        (p for p in prefs.get("profiles", []) if p["name"] == profile_name),
        None,
    )
    if not profile:
        raise HTTPException(status_code=400, detail=f"Voice profile not found: {profile_name}")

    clip_path = _resolve_clip(profile["reference_clip"])
    ref_text = profile.get("ref_text", "")
    language = payload.language

    target_pages = book["pages"]
    if payload.page_numbers:
        target_pages = [p for p in target_pages if p["page_number"] in payload.page_numbers]

    audio_dir = os.path.join(AUDIO_OUTPUT_DIR, book_id)
    os.makedirs(audio_dir, exist_ok=True)

    async def generate():
        for page in target_pages:
            page_num = page["page_number"]
            text = page.get("text", "").strip()
            if not text:
                yield json.dumps({"status": "skipped", "page_number": page_num, "reason": "no text"}) + "\n"
                continue

            books.update_page(book_id, page_num, audio_status="generating")
            yield json.dumps({"status": "started", "page_number": page_num}) + "\n"

            try:
                result = await asyncio.to_thread(
                    generate_voice_clone,
                    text=text,
                    language=language,
                    ref_audio_path=clip_path,
                    ref_text=ref_text if ref_text else None,
                    profile_name=profile_name,
                    model_size=ModelSize.LARGE,
                )

                if result.get("status") == "loading":
                    books.update_page(book_id, page_num, audio_status="error")
                    yield json.dumps({"status": "error", "page_number": page_num, "reason": "model loading"}) + "\n"
                    continue

                src_filename = result["filename"]
                src_path = os.path.join(AUDIO_OUTPUT_DIR, src_filename)
                dest_filename = f"page_{page_num:03d}.wav"
                dest_path = os.path.join(audio_dir, dest_filename)
                os.replace(src_path, dest_path)

                audio_filename = f"{book_id}/{dest_filename}"
                books.update_page(book_id, page_num, audio_filename=audio_filename, audio_status="ready")
                yield json.dumps({
                    "status": "progress",
                    "page_number": page_num,
                    "audio_filename": audio_filename,
                    "duration": result.get("duration", 0),
                }) + "\n"

            except Exception as e:
                books.update_page(book_id, page_num, audio_status="error")
                yield json.dumps({"status": "error", "page_number": page_num, "reason": str(e)}) + "\n"

        yield json.dumps({"status": "done"}) + "\n"

    return StreamingResponse(generate(), media_type="application/x-ndjson")


# ─── Voice profiles ──────────────────────────────────────────────────────────

@router.get("/reference-clips")
async def list_reference_clips():
    os.makedirs(VOICE_CLIPS_DIR, exist_ok=True)
    clips = [
        _serialize_clip(f)
        for f in sorted(os.listdir(VOICE_CLIPS_DIR))
        if not f.startswith(".")
        and os.path.splitext(f)[1].lower() in ALLOWED_AUDIO_EXTENSIONS
        and os.path.isfile(os.path.join(VOICE_CLIPS_DIR, f))
    ]
    return {"items": clips}


@router.post("/reference-clips")
async def upload_reference_clip(file: UploadFile = File(...)):
    return {"item": _save_clip(file)}


@router.get("/voice-clone/preferences")
async def voice_clone_preferences():
    return get_clone_preferences()


@router.get("/voice-clone/profiles")
async def voice_clone_profiles():
    return get_clone_profiles_state()


@router.post("/voice-clone/profiles")
async def create_voice_clone_profile(payload: VoiceCloneProfilePayload):
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Voice name is required")
    if not payload.reference_clip:
        raise HTTPException(status_code=400, detail="Reference clip is required")
    if not payload.ref_text.strip():
        raise HTTPException(status_code=400, detail="Reference transcript is required")
    _resolve_clip(payload.reference_clip)
    return create_clone_profile(
        name=payload.name,
        reference_clip=payload.reference_clip,
        ref_text=payload.ref_text,
    )


@router.put("/voice-clone/profiles/{profile_id}")
async def update_voice_clone_profile(profile_id: str, payload: VoiceCloneProfilePayload):
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Voice name is required")
    if not payload.reference_clip:
        raise HTTPException(status_code=400, detail="Reference clip is required")
    if not payload.ref_text.strip():
        raise HTTPException(status_code=400, detail="Reference transcript is required")
    _resolve_clip(payload.reference_clip)
    try:
        return update_clone_profile(
            profile_id=profile_id,
            name=payload.name,
            reference_clip=payload.reference_clip,
            ref_text=payload.ref_text,
        )
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Profile not found: {profile_id}")


@router.delete("/voice-clone/profiles/{profile_id}")
async def delete_voice_clone_profile(profile_id: str):
    try:
        return delete_clone_profile(profile_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Profile not found: {profile_id}")


@router.post("/voice-clone/profiles/selected")
async def select_voice_clone_profile(payload: VoiceCloneProfileSelectionPayload):
    try:
        return select_clone_profile(payload.selected_profile_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Profile not found: {payload.selected_profile_id}")


@router.get("/model-status")
async def model_status():
    from backend.models import model_manager, ModelVariant
    return model_manager.get_status(ModelVariant.VOICE_CLONE, ModelSize.LARGE)
