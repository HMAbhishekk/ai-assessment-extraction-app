import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createJob, updateJob } from "@/lib/jobStore";
import { runPipeline } from "@/lib/pipeline";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Could not parse upload." }, { status: 400 });
  }

  const questionFile = form.get("questionFile");
  const answerFile = form.get("answerFile");

  if (!(questionFile instanceof File) || !(answerFile instanceof File)) {
    return NextResponse.json({ error: "Both questionFile and answerFile are required." }, { status: 400 });
  }
  for (const f of [questionFile, answerFile]) {
    if (f.type && !ALLOWED_TYPES.has(f.type)) {
      return NextResponse.json({ error: `Unsupported file type: ${f.type}. Use PDF, PNG, or JPEG.` }, { status: 400 });
    }
  }

  const jobId = randomUUID();
  createJob(jobId);

  // Fire and forget - client polls GET /api/process/[id] for progress.
  runPipeline(jobId, questionFile, answerFile)
    .then((result) => {
      updateJob(jobId, { status: "done", step: "Done", progress: 100, result });
    })
    .catch((err) => {
      updateJob(jobId, { status: "error", error: err instanceof Error ? err.message : String(err) });
    });

  return NextResponse.json({ jobId }, { status: 202 });
}
