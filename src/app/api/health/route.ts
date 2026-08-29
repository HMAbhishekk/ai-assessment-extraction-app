import { NextResponse } from "next/server";
import { ollamaHealthy, OLLAMA_MODEL_NAME } from "@/lib/ollama";
import { ocrServiceHealthy } from "@/lib/ocrClient";

export const runtime = "nodejs";

export async function GET() {
  const [ollama, ocr] = await Promise.all([ollamaHealthy(), ocrServiceHealthy()]);
  const ok = ollama && ocr;
  return NextResponse.json({ ok, ollama, ocrService: ocr, model: OLLAMA_MODEL_NAME }, { status: ok ? 200 : 503 });
}
