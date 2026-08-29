"""
Minimal stand-in for the Ollama /api/chat endpoint, used ONLY to
integration-test the rest of the pipeline (uploads, OCR wiring, cropping,
matching, grading merge, frontend) in an environment that can't reach
ollama.com. Not part of the shipped app.

Vision calls (images present) are answered by returning literal noise -
this is intentionally dumb so the *real* work of grouping/labelling is
verified via the actual EasyOCR text already embedded in the request
(we cheat by having the "vision" model just echo back a marker; the real
matching-logic test instead runs directly against pipeline functions -
see test_pipeline.mjs). Text (JSON) calls implement just enough real logic
to produce plausible structured output for our synthetic fixtures.
"""
import json
import re
from http.server import BaseHTTPRequestHandler, HTTPServer

import base64
import io
import numpy as np
from PIL import Image
import easyocr

_reader = easyocr.Reader(["en"], gpu=False)


def ocr_image_fallback(b64):
    try:
        img = Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
        results = _reader.readtext(np.array(img), detail=0, paragraph=True)
        return " ".join(results).strip()
    except Exception:
        return ""


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"Ollama is running")

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length) or b"{}")
        messages = body.get("messages", [])
        user_msg = next((m for m in reversed(messages) if m.get("role") == "user"), {})
        content = user_msg.get("content", "")
        images = user_msg.get("images")

        if images:
            text = ocr_image_fallback(images[0])
            reply = text if text.strip() else "[empty]"
        elif "Respond with ONLY a JSON object" in content and "questions" in content:
            reply = json.dumps(self._fake_structure(content))
        elif "matches" in content:
            reply = json.dumps({"matches": []})
        elif "gradings" in content or "correctness" in content:
            reply = json.dumps(self._fake_grading(content))
        else:
            reply = "{}"

        resp = json.dumps({"message": {"role": "assistant", "content": reply}}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(resp)))
        self.end_headers()
        self.wfile.write(resp)

    def _fake_structure(self, prompt):
        m = re.search(r'"""\n(.*)\n"""', prompt, re.S)
        text = m.group(1) if m else prompt
        questions = []
        for line in text.splitlines():
            qm = re.match(r"\s*Q?(\d+)[\s_.:\-]*(?:\(([a-hA-H])\))?[\s_.:\-]*(.*)", line.strip())
            if qm and qm.group(3):
                questions.append({
                    "number": qm.group(1),
                    "subpart": qm.group(2).lower() if qm.group(2) else None,
                    "text": qm.group(3).strip(),
                    "marks": None,
                })
        return {"questions": questions}

    def _fake_grading(self, prompt):
        m = re.search(r"Items:\n(.*)\n\nRespond", prompt, re.S)
        items = []
        if m:
            try:
                items = json.loads(m.group(1))
            except Exception:
                items = []
        out_items = [
            {
                "id": it["id"],
                "correctness": "correct",
                "score": it.get("maxMarks", 2),
                "feedback": "Looks reasonable.",
            }
            for it in items
        ]
        return {"items": out_items, "overallFeedback": "Solid overall performance in this test run."}


if __name__ == "__main__":
    HTTPServer(("127.0.0.1", 11434), Handler).serve_forever()
