import type { OcrPage } from "./types";

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || "http://127.0.0.1:8001";

export interface IngestResponse {
  pageCount: number;
  pages: OcrPage[];
}

export async function ingestDocument(file: File): Promise<IngestResponse> {
  const form = new FormData();
  form.append("file", file, file.name || "upload");
  const res = await fetch(`${OCR_SERVICE_URL}/ingest`, { method: "POST", body: form });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OCR service failed (${res.status}): ${body.slice(0, 500)}`);
  }
  return (await res.json()) as IngestResponse;
}

export async function ocrServiceHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${OCR_SERVICE_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
