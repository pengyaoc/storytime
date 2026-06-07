import os
import re
import asyncio
from typing import Optional

_CJK_RE = re.compile(r"[一-鿿㐀-䶿　-〿＀-￯]")


def _is_chinese(text: str) -> bool:
    cjk_count = sum(1 for c in text if _CJK_RE.match(c))
    return cjk_count > len(text) * 0.3


def _clean_chinese_lines(lines: list[str]) -> str:
    # Remove spaces introduced between OCR line observations for CJK text.
    # Keep a newline only when the previous line ends a sentence.
    sentence_endings = set("。！？…」』）")
    parts = []
    for i, line in enumerate(lines):
        parts.append(line)
        if i < len(lines) - 1:
            # Use newline after sentence-ending punctuation, otherwise nothing
            sep = "\n" if line and line[-1] in sentence_endings else ""
            parts.append(sep)
    return "".join(parts)


def ocr_image(image_path: str) -> str:
    """Extract text from a book page image using Apple Vision Framework."""
    try:
        import Vision
        import Quartz
    except ImportError:
        raise RuntimeError(
            "Apple Vision Framework not available. Install pyobjc-framework-Vision and pyobjc-framework-Quartz."
        )

    abs_path = os.path.abspath(image_path)
    url = Quartz.CFURLCreateFromFileSystemRepresentation(
        None, abs_path.encode("utf-8"), len(abs_path.encode("utf-8")), False
    )
    if url is None:
        raise ValueError(f"Could not create URL from path: {image_path}")

    handler = Vision.VNImageRequestHandler.alloc().initWithURL_options_(url, {})

    request = Vision.VNRecognizeTextRequest.alloc().init()
    request.setRecognitionLevel_(Vision.VNRequestTextRecognitionLevelAccurate)
    request.setUsesLanguageCorrection_(True)
    request.setRecognitionLanguages_(["zh-Hans", "zh-Hant", "en-US"])

    success, error = handler.performRequests_error_([request], None)
    if not success:
        raise RuntimeError(f"Vision OCR failed: {error}")

    results = request.results()
    if not results:
        return ""

    lines = []
    for observation in results:
        candidates = observation.topCandidates_(1)
        if candidates and len(candidates) > 0:
            lines.append(candidates[0].string())

    raw = " ".join(lines).strip()
    if _is_chinese(raw):
        return _clean_chinese_lines(lines).strip()
    return raw


async def ocr_image_async(image_path: str) -> str:
    return await asyncio.to_thread(ocr_image, image_path)
