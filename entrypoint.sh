#!/bin/bash
set -e

echo "[entrypoint] starting ollama serve..."
ollama serve &
OLLAMA_PID=$!

echo "[entrypoint] waiting for ollama..."
for i in $(seq 1 60); do
  if curl -s "http://127.0.0.1:11434" >/dev/null 2>&1; then
    echo "[entrypoint] ollama is up"
    break
  fi
  sleep 1
done

echo "[entrypoint] starting OCR microservice on :8001..."
python3 -m uvicorn ocr_service.app:app --host 127.0.0.1 --port 8001 &
OCR_PID=$!

echo "[entrypoint] waiting for OCR service..."
for i in $(seq 1 120); do
  if curl -s "http://127.0.0.1:8001/health" >/dev/null 2>&1; then
    echo "[entrypoint] OCR service is up"
    break
  fi
  sleep 1
done

echo "[entrypoint] starting Next.js on :${PORT:-7860}..."
PORT=${PORT:-7860} npm start &
WEB_PID=$!

# If any of the three dies, bring the whole container down so the
# platform restarts it rather than serving a half-broken app.
wait -n "$OLLAMA_PID" "$OCR_PID" "$WEB_PID"
EXIT_CODE=$?
echo "[entrypoint] a process exited (code $EXIT_CODE), shutting down"
kill "$OLLAMA_PID" "$OCR_PID" "$WEB_PID" 2>/dev/null || true
exit $EXIT_CODE
