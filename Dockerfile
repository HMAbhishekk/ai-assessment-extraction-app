# Single-container deployment for Hugging Face Spaces (Docker SDK).
# Runs three processes together: Ollama (local LLM), a Python OCR
# microservice (EasyOCR line/block detection), and the Next.js web app.
#
# Why one container: HF Spaces' free CPU tier gives ~16GB RAM and no
# serverless-style timeout, which is exactly what a local model + OCR
# pipeline needs, and keeping everything on localhost avoids CORS/auth
# plumbing between services.

FROM node:22-bookworm-slim AS base

# ---- OS deps -----------------------------------------------------------
# zstd is required by Ollama's install.sh to extract its own archive -
# without it the install step fails with "This version requires zstd".
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates zstd python3 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*

# ---- Ollama --------------------------------------------------------------
RUN curl -fsSL https://ollama.com/install.sh | sh

# ---- Hugging Face Spaces convention: run as a non-root user -------------
# Not pinning a specific UID here - the node:22-bookworm-slim base image
# already ships its own "node" user at UID 1000, so a hardcoded `-u 1000`
# collides with it ("UID 1000 is not unique"). Nothing else in this file
# depends on the numeric UID, only on the "user" username, so letting
# useradd pick the next free UID is safe.
RUN useradd -m user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

# Model used for BOTH vision transcription (handwritten answer blocks) and
# text reasoning (question structuring, answer mapping, grading). One
# model = simpler + lower RAM than juggling two. Override at build time
# with --build-arg MODEL_NAME=moondream for a much smaller/faster (but
# less accurate) alternative if the default is too slow on your hardware.
ARG MODEL_NAME=minicpm-v
ENV OLLAMA_MODEL=${MODEL_NAME} \
    OLLAMA_MODELS=/home/user/.ollama/models \
    OLLAMA_HOST=127.0.0.1:11434 \
    OCR_SERVICE_URL=http://127.0.0.1:8001 \
    OLLAMA_URL=http://127.0.0.1:11434 \
    PORT=7860 \
    NODE_ENV=production

WORKDIR /app

# ---- Python OCR service deps --------------------------------------------
COPY --chown=user ocr_service/requirements.txt ./ocr_service/requirements.txt
RUN pip3 install --break-system-packages --no-cache-dir -r ocr_service/requirements.txt

# ---- Node deps + build ---------------------------------------------------
COPY --chown=user package.json package-lock.json ./
# --include=dev overrides the NODE_ENV=production set above, which would
# otherwise make npm skip devDependencies - `next build` needs tailwindcss
# and @tailwindcss/postcss (both devDependencies) at build time regardless
# of NODE_ENV. This doesn't affect the app at runtime, only what's present
# in node_modules for this build step.
RUN npm ci --include=dev
COPY --chown=user . .
RUN npm run build

# ---- Pre-pull the Ollama model at BUILD time ----------------------------
# Baking it into the image avoids a multi-GB re-download every time the
# Space wakes up from sleep (free-tier Spaces sleep after inactivity).
RUN mkdir -p ${OLLAMA_MODELS} && chown -R user:user /home/user/.ollama
USER user
RUN (ollama serve > /tmp/ollama-build.log 2>&1 &) && \
    for i in $(seq 1 30); do curl -s http://127.0.0.1:11434 >/dev/null && break; sleep 1; done && \
    ollama pull ${OLLAMA_MODEL} && \
    (pkill ollama || true) && sleep 2

USER root
RUN chmod +x /app/entrypoint.sh

USER user
EXPOSE 7860

CMD ["/app/entrypoint.sh"]
