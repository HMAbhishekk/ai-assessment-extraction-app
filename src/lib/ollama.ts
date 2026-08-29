// Thin client for the local Ollama server. One model handles both vision
// (transcribing cropped handwriting blocks) and text reasoning (structuring
// questions, mapping answers, grading) - see Dockerfile for why.

const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const MODEL = process.env.OLLAMA_MODEL || "minicpm-v";
const TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 180_000);

interface ChatMessage {
  role: "user" | "system" | "assistant";
  content: string;
  images?: string[]; // base64, no data-uri prefix
}

async function chat(messages: ChatMessage[], opts: { json?: boolean } = {}): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: false,
        ...(opts.json ? { format: "json" } : {}),
        options: { temperature: 0.1 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Ollama request failed (${res.status}): ${body.slice(0, 500)}`);
    }
    const data = await res.json();
    const content: string | undefined = data?.message?.content;
    if (typeof content !== "string") {
      throw new Error(`Unexpected Ollama response shape: ${JSON.stringify(data).slice(0, 500)}`);
    }
    return content;
  } finally {
    clearTimeout(timer);
  }
}

function stripFences(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

/** Attempt to salvage a JSON object/array out of a possibly-messy LLM reply. */
function extractJson<T>(raw: string): T {
  const cleaned = stripFences(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // fall back: find the first {...} or [...] span
    const objStart = cleaned.indexOf("{");
    const arrStart = cleaned.indexOf("[");
    const starts = [objStart, arrStart].filter((i) => i >= 0);
    if (starts.length === 0) throw new Error(`Could not parse JSON from model output: ${cleaned.slice(0, 300)}`);
    const start = Math.min(...starts);
    const isArray = start === arrStart;
    const open = isArray ? "[" : "{";
    const close = isArray ? "]" : "}";
    let depth = 0;
    let end = -1;
    for (let i = start; i < cleaned.length; i++) {
      if (cleaned[i] === open) depth++;
      else if (cleaned[i] === close) {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) throw new Error(`Could not find balanced JSON in model output: ${cleaned.slice(0, 300)}`);
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  }
}

/** Text-only reasoning call that expects a JSON response. */
export async function ollamaJson<T>(prompt: string, system?: string): Promise<T> {
  const messages: ChatMessage[] = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });
  const raw = await chat(messages, { json: true });
  return extractJson<T>(raw);
}

/** Vision call: transcribe / describe an image crop. Returns plain text. */
export async function ollamaVisionText(prompt: string, imageBase64NoPrefix: string): Promise<string> {
  const messages: ChatMessage[] = [{ role: "user", content: prompt, images: [imageBase64NoPrefix] }];
  const raw = await chat(messages, { json: false });
  return raw.trim();
}

export async function ollamaHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

export const OLLAMA_MODEL_NAME = MODEL;
