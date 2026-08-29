"""
OCR line/paragraph detection microservice.

Responsibilities (kept deliberately narrow):
  - Accept an uploaded question paper OR answer sheet (PDF or image).
  - Render every page to a PNG (for both OCR and for on-screen display).
  - Run EasyOCR text detection+recognition to get every text LINE with an
    accurate bounding box (this is what makes "highlight the exact answer
    region" possible).
  - Group nearby lines into paragraph-like BLOCKS (candidate answer regions).

Recognition quality on messy handwriting is not trusted here - the raw
`text` EasyOCR returns is passed along as a *hint* only. The Node side
sends a cropped image of each block to a local vision LLM (Ollama) for the
actual transcription, which is far more accurate on real handwriting than
a generic OCR recognizer. Detection (finding *where* the text is), on the
other hand, EasyOCR handles well regardless of legibility, which is exactly
what we need for bounding boxes.
"""
import io
import re
import base64
import statistics
from typing import List, Tuple

import fitz  # PyMuPDF
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import easyocr

app = FastAPI(title="handwriting-ocr-service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Loaded once at process start - this is the slow part (a few seconds to
# ~1min depending on hardware), so we do it at import time rather than
# per-request.
_reader = easyocr.Reader(["en"], gpu=False)

RENDER_DPI = 220
MAX_DIM = 2200  # safety cap so a huge PDF page doesn't blow up memory/time


def _pdf_to_images(data: bytes) -> List[Image.Image]:
    doc = fitz.open(stream=data, filetype="pdf")
    images = []
    zoom = RENDER_DPI / 72.0
    mat = fitz.Matrix(zoom, zoom)
    for page in doc:
        pix = page.get_pixmap(matrix=mat, alpha=False)
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        images.append(_cap_size(img))
    doc.close()
    return images


def _cap_size(img: Image.Image) -> Image.Image:
    w, h = img.size
    longest = max(w, h)
    if longest > MAX_DIM:
        scale = MAX_DIM / longest
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    return img


def _load_images(filename: str, data: bytes) -> List[Image.Image]:
    lower = (filename or "").lower()
    is_pdf = lower.endswith(".pdf") or data[:4] == b"%PDF"
    if is_pdf:
        imgs = _pdf_to_images(data)
        if not imgs:
            raise HTTPException(400, "Could not read any pages from PDF")
        return imgs
    try:
        img = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception as e:
        raise HTTPException(400, f"Unsupported/unreadable file: {e}")
    return [_cap_size(img)]


def _img_to_b64(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def _quad_to_bbox(quad) -> Tuple[float, float, float, float]:
    xs = [p[0] for p in quad]
    ys = [p[1] for p in quad]
    return (min(xs), min(ys), max(xs), max(ys))


# Detects "this text starts a new labelled question/answer", e.g.
# "Q5.", "Question 3", "Ans 2(a)", "11 (a)", "3)". Anchored at the start of
# a line only - used as a hard signal to split paragraph blocks, since a
# new label is a much stronger real-world cue than whitespace (students
# often leave little to no gap between answers).
_LABEL_START_RE = re.compile(
    r"^\s*(?:q(?:uestion)?\.?|ans(?:wer)?\.?)?\s*(?:no\.?)?\s*[:\-]?\s*\(?\s*\d{1,3}\s*\)?\s*[\.\)\-:]?\s*\(?[a-hA-H]?\)?\s*[\.\)\-:]?\s+\S",
    re.IGNORECASE,
)


def _looks_like_new_label(text: str) -> bool:
    return bool(_LABEL_START_RE.match(text.strip()))


def _cluster_rows(lines: List[dict]) -> List[List[dict]]:
    """Group raw EasyOCR detections into visual rows. A plain sort-by-y is
    not enough: two word clusters on the same visual line frequently get
    slightly different top-y (different cap-heights/descenders), which can
    flip their left-to-right order and scramble a sentence. We cluster
    using a tolerance based on the median detection height instead.
    """
    if not lines:
        return []
    heights = [l["bbox"][3] - l["bbox"][1] for l in lines]
    median_h = statistics.median(heights) if heights else 0.02
    row_threshold = max(median_h * 0.6, 0.006)

    remaining = sorted(lines, key=lambda l: l["bbox"][1])
    rows: List[List[dict]] = []
    current_row = [remaining[0]]
    row_y = remaining[0]["bbox"][1]
    for line in remaining[1:]:
        if abs(line["bbox"][1] - row_y) <= row_threshold:
            current_row.append(line)
        else:
            rows.append(current_row)
            current_row = [line]
            row_y = line["bbox"][1]
    rows.append(current_row)

    for row in rows:
        row.sort(key=lambda l: l["bbox"][0])
    return rows


def _detect_lines(img: Image.Image):
    """Run OCR and merge same-row fragments into proper logical lines.

    EasyOCR frequently splits one visual line into multiple detections
    (e.g. a leading "Q1." label detected separately from the sentence that
    follows it). Feeding those to the LLM as two unrelated lines makes
    reconstruction harder than it needs to be, so we merge anything on the
    same row here - once per image, deterministically - rather than
    relying on the LLM to notice the split.
    """
    arr = np.array(img)
    results = _reader.readtext(arr, detail=1, paragraph=False)
    w, h = img.size
    raw = []
    for quad, text, conf in results:
        x0, y0, x1, y1 = _quad_to_bbox(quad)
        raw.append({
            "bbox": [x0 / w, y0 / h, x1 / w, y1 / h],
            "text": text,
            "confidence": float(conf),
        })
    rows = _cluster_rows(raw)
    merged = []
    for row in rows:
        x0 = min(l["bbox"][0] for l in row)
        y0 = min(l["bbox"][1] for l in row)
        x1 = max(l["bbox"][2] for l in row)
        y1 = max(l["bbox"][3] for l in row)
        merged.append({
            "bbox": [x0, y0, x1, y1],
            "text": " ".join(l["text"] for l in row),
            "confidence": sum(l["confidence"] for l in row) / len(row),
        })
    return merged


def _group_into_blocks(lines: List[dict]):
    """Merge vertically-adjacent lines into paragraph-like blocks - the
    candidate answer regions we'll crop and transcribe.

    A new block starts whenever EITHER (a) the vertical gap to the
    previous line is large relative to recent line heights, OR (b) the
    line itself looks like the start of a new labelled question/answer
    (e.g. "Q5.") - the latter matters because real students often leave
    little to no blank space between consecutive answers, so whitespace
    alone under-splits. This is a *hint* for grouping candidate answer
    regions, not the final source of truth for correctness - final
    question/answer identity comes from the label-matching + LLM steps
    downstream.
    """
    if not lines:
        return []
    ordered = sorted(lines, key=lambda l: l["bbox"][1])
    blocks = []
    current = [ordered[0]]
    heights = [ordered[0]["bbox"][3] - ordered[0]["bbox"][1]]

    for line in ordered[1:]:
        prev = current[-1]
        gap = line["bbox"][1] - prev["bbox"][3]
        avg_h = statistics.mean(heights[-5:]) if heights else 0.02
        threshold = max(avg_h * 1.6, 0.015)
        new_label = _looks_like_new_label(line["text"])
        if (gap > threshold or new_label) and current:
            blocks.append(current)
            current = [line]
            heights = [line["bbox"][3] - line["bbox"][1]]
        else:
            current.append(line)
            heights.append(line["bbox"][3] - line["bbox"][1])
    blocks.append(current)

    out = []
    for i, blk in enumerate(blocks):
        x0 = min(l["bbox"][0] for l in blk)
        y0 = min(l["bbox"][1] for l in blk)
        x1 = max(l["bbox"][2] for l in blk)
        y1 = max(l["bbox"][3] for l in blk)
        text_hint = " ".join(l["text"] for l in blk)
        out.append({
            "id": f"blk-{i}",
            "bbox": [x0, y0, x1, y1],
            "textHint": text_hint,
            "lineCount": len(blk),
        })
    return out


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/ingest")
async def ingest(file: UploadFile = File(...)):
    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file")
    images = _load_images(file.filename or "upload", data)

    pages = []
    for idx, img in enumerate(images):
        lines = _detect_lines(img)
        blocks = _group_into_blocks(lines)
        pages.append({
            "pageIndex": idx,
            "width": img.size[0],
            "height": img.size[1],
            "image": _img_to_b64(img),
            "lines": lines,
            "blocks": blocks,
        })

    return {"pageCount": len(pages), "pages": pages}
