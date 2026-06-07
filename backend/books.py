import json
import os
import shutil
import threading
import uuid
from datetime import datetime
from typing import Optional


BOOKS_DIR = "books"
UPLOADS_DIR = "uploads"
AUDIO_OUTPUT_DIR = "audio_output"

_book_locks: dict[str, threading.Lock] = {}
_locks_mutex = threading.Lock()


def _get_book_lock(book_id: str) -> threading.Lock:
    with _locks_mutex:
        if book_id not in _book_locks:
            _book_locks[book_id] = threading.Lock()
        return _book_locks[book_id]


def _book_path(book_id: str) -> str:
    return os.path.join(BOOKS_DIR, f"{book_id}.json")


def _write_book(book: dict) -> dict:
    path = _book_path(book["id"])
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(book, f, ensure_ascii=True, indent=2)
    os.replace(tmp, path)
    return book


def _read_book(book_id: str) -> dict:
    path = _book_path(book_id)
    if not os.path.exists(path):
        raise KeyError(book_id)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def list_books() -> list[dict]:
    os.makedirs(BOOKS_DIR, exist_ok=True)
    books = []
    for fname in os.listdir(BOOKS_DIR):
        if not fname.endswith(".json"):
            continue
        path = os.path.join(BOOKS_DIR, fname)
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            pages = data.get("pages", [])
            first_page = pages[0] if pages else None
            books.append({
                "id": data["id"],
                "title": data.get("title", ""),
                "created_at": data.get("created_at", ""),
                "voice_profile": data.get("voice_profile", ""),
                "page_count": len(pages),
                "cover_image": first_page["image_filename"] if first_page else None,
            })
        except Exception:
            continue
    books.sort(key=lambda b: b.get("created_at", ""), reverse=True)
    return books


def get_book(book_id: str) -> dict:
    with _get_book_lock(book_id):
        return _read_book(book_id)


def create_book(title: str) -> dict:
    book_id = uuid.uuid4().hex[:12]
    book = {
        "id": book_id,
        "title": title.strip() or "Untitled Book",
        "created_at": datetime.now().isoformat(),
        "voice_profile": "",
        "pages": [],
    }
    os.makedirs(BOOKS_DIR, exist_ok=True)
    with _get_book_lock(book_id):
        return _write_book(book)


def update_book(book_id: str, **fields) -> dict:
    with _get_book_lock(book_id):
        book = _read_book(book_id)
        for key in ("title", "voice_profile"):
            if key in fields and fields[key] is not None:
                book[key] = fields[key]
        return _write_book(book)


def delete_book(book_id: str) -> None:
    with _get_book_lock(book_id):
        path = _book_path(book_id)
        if not os.path.exists(path):
            raise KeyError(book_id)
        os.remove(path)

    for d in (
        os.path.join(UPLOADS_DIR, book_id),
        os.path.join(AUDIO_OUTPUT_DIR, book_id),
    ):
        if os.path.isdir(d):
            shutil.rmtree(d)


def add_page(book_id: str, image_filename: str, text: str = "") -> dict:
    with _get_book_lock(book_id):
        book = _read_book(book_id)
        page_number = len(book["pages"]) + 1
        page = {
            "page_number": page_number,
            "image_filename": image_filename,
            "text": text,
            "audio_filename": "",
            "audio_status": "none",
        }
        book["pages"].append(page)
        _write_book(book)
        return page


def update_page(
    book_id: str,
    page_number: int,
    *,
    text: Optional[str] = None,
    audio_filename: Optional[str] = None,
    audio_status: Optional[str] = None,
) -> dict:
    with _get_book_lock(book_id):
        book = _read_book(book_id)
        page = next((p for p in book["pages"] if p["page_number"] == page_number), None)
        if page is None:
            raise KeyError(f"Page {page_number} not found in book {book_id}")
        if text is not None:
            page["text"] = text
        if audio_filename is not None:
            page["audio_filename"] = audio_filename
        if audio_status is not None:
            page["audio_status"] = audio_status
        _write_book(book)
        return page


def delete_page(book_id: str, page_number: int) -> dict:
    with _get_book_lock(book_id):
        book = _read_book(book_id)
        original_len = len(book["pages"])
        book["pages"] = [p for p in book["pages"] if p["page_number"] != page_number]
        if len(book["pages"]) == original_len:
            raise KeyError(f"Page {page_number} not found in book {book_id}")
        for i, page in enumerate(book["pages"], 1):
            page["page_number"] = i
        return _write_book(book)
