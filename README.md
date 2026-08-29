---
title: AI Assessment Extraction & Answer Mapping
emoji: 📝
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# AI Assessment Extraction & Answer Mapping

A teacher uploads a question paper and one student's handwritten answer sheet. The app extracts every question (in printed order, with labelled sub-parts like `11 (a)` / `11 (b)` kept as separate entries), reads the student's handwriting, maps each answer back to the question it answers, highlights the exact region of the answer sheet an answer came from, and gives a best-effort AI grade with feedback.

Everything runs on a **self-hosted, free, local AI model (Ollama)** - no paid API, no API key, no database. State lives in server memory for the lifetime of a request.

## Try it

A sample question paper and a synthetic (typed, not real handwriting) answer sheet are included in [`samples/`](./samples) if you want to try the live app without your own files.

## How it works

```
Question paper ──┐                                  ┌── Question list (ordered, sub-parts split)
                  ├─► OCR (EasyOCR) ─► Ollama (LLM) ─┤
Answer sheet ─────┘        │                         └── Answer blocks (text + bounding box + page)
                           │
                           ▼
                 Label matching (regex) → page-boundary continuation → LLM semantic fallback
                           │
                           ▼
                 Question ⇄ Answer mapping + AI grading
```

**Why a two-stage OCR + LLM pipeline instead of just asking a vision model to read the page?** Local vision models (LLaVA, Qwen-VL, MiniCPM-V, etc.) are noticeably weaker on messy/cursive handwriting than commercial models, and none of them reliably output accurate bounding boxes - which is a *hard requirement* here ("highlight the exact answer region"). So the two jobs are split between two things that are each good at their job:

1. **EasyOCR** (Python microservice, [`ocr_service/`](./ocr_service)) finds *where* every line of text is - detection is far more reliable than recognition on handwriting, and gives us real, accurate bounding boxes. It also groups nearby lines into paragraph-like "blocks" (candidate answers), splitting on both a blank-space gap *and* on spotting the start of a new labelled answer (e.g. "Q5."). The latter matters because real students often leave little to no gap between answers.
2. **Ollama** (a local LLM, [`src/lib/ollama.ts`](./src/lib/ollama.ts)) does everything that needs actual reading comprehension: transcribing each cropped handwritten block (multimodal call), turning the question paper's raw OCR text into a clean, ordered, structured question list, semantically matching any answer that isn't clearly labelled, and grading.

One model (default: `minicpm-v`) handles both the vision and text-reasoning calls, to keep RAM usage down on a free CPU host.

**Answer mapping** ([`src/lib/pipeline.ts`](./src/lib/pipeline.ts)) runs in three passes:
1. **Direct label match** - most students write "Q3", "3(a)", "Ans 5" etc. at the start of an answer; a block with a detected label is matched straight to that question by number/sub-part. Matching by label rather than physical position is what makes "questions answered out of order" work correctly.
2. **Page-boundary continuation** - an unlabelled block at the very top of a page is treated as the continuation of whichever question's answer was still open at the end of the previous page. This is deliberately scoped to page breaks only (not "any unlabelled block absorbs into whatever came before it"), so a stray unlabelled note sitting between two answers on the same page correctly stays unmatched instead of being silently swallowed into the wrong question.
3. **LLM semantic fallback** - anything still unresolved (a question with no block, or a block with no question) is given to the LLM once, asking it to propose matches only where it's genuinely confident. Anything left over becomes either "unanswered" (question side) or an "answer that doesn't match any question" (block side), both surfaced explicitly in the UI.

**Out-of-order detection**: for answered questions, we compare each one's physical position on the page(s) against the question answered immediately before it in printed order; if it appears earlier in the document, it's flagged "out of order" in the UI.

**Grading**: since no answer key is uploaded, the model grades using its own subject-matter knowledge (correctness, a score out of that question's own marks - parsed from the paper, e.g. "[5]", defaulting to 2 if unspecified - and short feedback per question, plus an overall summary). This is clearly a best-effort feature, not authoritative - see Limitations.

## AI model / API used

**[Ollama](https://ollama.com)**, running locally inside the same container as the app - no external API, no API key, free. Default model: `minicpm-v` (chosen for its relatively strong OCR/document understanding for its size). Both the handwriting-transcription (vision) calls and the text-reasoning calls (question structuring, answer matching, grading) use this one model, to keep memory usage manageable on a free CPU host.

You can swap the model without touching code:

```bash
docker build --build-arg MODEL_NAME=moondream -t assessment-app .
```

`moondream` is a much smaller/faster fallback if `minicpm-v` is too slow on your hosting tier (at some cost to transcription accuracy).

## Running locally

**With Docker (closest to production):**

```bash
docker build -t assessment-app .
docker run -p 7860:7860 assessment-app
# open http://localhost:7860
```

The first build pulls and bakes in the Ollama model (multiple GB - this step needs a real internet connection and will take a while). Building and running this way needs a machine with a few GB of free RAM.

**Without Docker (Node + Python + Ollama installed separately):**

```bash
# 1. Ollama
curl -fsSL https://ollama.com/install.sh | sh
ollama pull minicpm-v
ollama serve &

# 2. OCR microservice
pip install -r ocr_service/requirements.txt
python3 -m uvicorn ocr_service.app:app --port 8001 &

# 3. Web app
npm install
npm run build && npm start
```

**Without Ollama installed at all** (useful for UI/pipeline-wiring development): [`dev/fake_ollama_for_local_testing.py`](./dev/fake_ollama_for_local_testing.py) is a tiny stand-in that speaks the same `/api/chat` shape Ollama does, backed by EasyOCR instead of a real LLM. It's how this app's OCR-to-mapping-to-grading pipeline was integration-tested in an environment that couldn't reach ollama.com. It is *not* a substitute for the real model's accuracy - just a wiring check. Run it on port 11434 instead of real Ollama and everything else works the same way.

## Deploying to a live URL (Hugging Face Spaces)

Hugging Face Spaces' free tier gives a Docker container ~16GB RAM and no serverless-style timeout, which local-model inference needs (Vercel/Railway's free tiers can't run Ollama at all - see below).

1. Create a Space at [huggingface.co/new-space](https://huggingface.co/new-space): pick **Docker** as the SDK, any name, CPU basic (free) hardware.
2. Push this repo's contents to the Space's git remote (shown on the Space's page after creation), e.g.:
   ```bash
   git remote add space https://huggingface.co/spaces/<your-username>/<space-name>
   git push space main
   ```
3. The Space builds the Dockerfile automatically (this bakes in the Ollama model - expect the first build to take a while). Once it's done, the Space's page *is* your live URL.
4. If the default `minicpm-v` model is too slow on the free CPU tier, edit the Dockerfile's `ARG MODEL_NAME=minicpm-v` to a smaller model (e.g. `moondream`) and push again.

**Why not Vercel or Railway directly?** Vercel's serverless functions can't run a persistent background process like `ollama serve`, and have execution-time limits far shorter than local CPU inference needs. Railway's free tier is 512MB RAM - nowhere near enough for a multi-GB model. If you'd rather use those, the app also splits its backend URLs via `OLLAMA_URL`/`OCR_SERVICE_URL` env vars, so you could deploy the Next.js app to Vercel and point it at an Ollama+OCR backend hosted elsewhere (e.g. still on Hugging Face Spaces) - more moving parts, not necessary for this assignment.

## Assumptions & limitations

- **Single-column layout assumed.** Multi-column answer sheets aren't explicitly handled; block grouping is a top-to-bottom, then left-to-right heuristic.
- **No answer key.** Grading uses the model's own subject knowledge, not a teacher-provided rubric - treat scores/feedback as a starting point for the teacher, not ground truth.
- **Continuation heuristic is page-boundary-only.** If a student's answer is genuinely interrupted by something else *on the same page* and then resumes further down, that resumption won't be auto-linked (it shows up as a separate unmatched block instead) - a deliberate trade-off to avoid the opposite, worse failure mode of unrelated notes silently merging into the wrong answer.
- **First request after a cold start is slow.** Free-tier Spaces sleep after inactivity; the first request after waking has to load the model into memory.
- **CPU-only inference.** No GPU on the free tier, so processing a multi-page handwritten answer sheet can take one to a few minutes - the UI shows live progress for this reason.
- **English handwriting.** EasyOCR is configured for English; other languages would need a different detector language pack.
- **In-memory only, per the assignment's constraints** - jobs (and their results) don't survive a server restart, and there's no multi-user isolation beyond per-job IDs.
- **The sidebar/top bar mirror the full VedaAI product shell from the Figma design** (Home, My Classroom, Assignments, My Library, notifications, profile menu), but only **Exams** is the feature this assignment asks for. The other nav items are real navigation - not dead buttons - they just land on an honest "outside this demo's scope" screen instead of a fake fully-built page. **Settings** is the one exception: it's backed by the app's own `/api/health` endpoint and shows a live Ollama/OCR-service connectivity check, since there are no real user-configurable settings to expose in an app with no accounts or database.

## Project structure

```
src/app/               Next.js pages + API routes (upload, job status polling)
src/components/        App shell (sidebar/top bar), upload, processing, and results
                        (question list + zoomable/paginated answer-sheet viewer) UI
src/lib/                pipeline.ts (orchestration), ollama.ts (LLM client), matching.ts (label regex),
                        ocrClient.ts, jobStore.ts (in-memory jobs), types.ts
ocr_service/            Python FastAPI service: PDF/image → page images + OCR lines/blocks
dev/                    Local-testing-only fake Ollama stand-in + a Playwright screenshot
                        script for visually checking the UI (neither used in production)
samples/                Sample question paper + answer sheet to try the deployed app with
Dockerfile              Single-container build: Ollama + OCR service + Next.js, for Hugging Face Spaces
entrypoint.sh           Starts all three processes together at container runtime
```
