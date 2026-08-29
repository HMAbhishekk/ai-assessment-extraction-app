import sharp from "sharp";
import { ingestDocument } from "./ocrClient";
import { ollamaJson, ollamaVisionText } from "./ollama";
import { detectLabel, labelKey, type DetectedLabel } from "./matching";
import { updateJob } from "./jobStore";
import type {
  AnswerBlock,
  Grading,
  MappingEntry,
  OcrPage,
  ProcessResult,
  Question,
} from "./types";

function report(jobId: string, step: string, progress: number) {
  updateJob(jobId, { step, progress, status: "processing" });
}

// ---------------------------------------------------------------------
// Step 1: question paper -> structured question list
// ---------------------------------------------------------------------

interface RawQuestion {
  number: string;
  subpart: string | null;
  text: string;
  marks?: string | null;
}

function reconstructPageText(pages: OcrPage[]): string {
  return pages
    .map((p, i) => {
      const lines = [...p.lines].sort((a, b) => a.bbox[1] - b.bbox[1] || a.bbox[0] - b.bbox[0]);
      const text = lines.map((l) => l.text).join("\n");
      return `[Page ${i + 1}]\n${text}`;
    })
    .join("\n\n");
}

const QUESTION_STRUCTURE_PROMPT = `You are extracting exam questions from OCR'd text of a question paper. The OCR text may contain minor recognition noise (stray punctuation, misread characters) - use your judgement to recover the intended question text, but do not invent content that isn't implied by the text.

Rules:
- Extract EVERY question, in the exact order they are printed.
- If a question has labelled sub-parts (e.g. "11 (a)" and "11 (b)", or "Q4 i)" / "Q4 ii)"), treat each sub-part as its own separate entry, sharing the same "number" but with a different "subpart".
- Preserve the original printed numbering exactly as written (do not renumber).
- If a question has no sub-parts, set "subpart" to null.
- Skip section headers, instructions, and pure formatting text (e.g. "SECTION A", "Answer any five questions") - only extract actual question items.
- If marks are shown (e.g. "[5]", "(10 marks)"), capture them in "marks", else null.

Respond with ONLY a JSON object of the shape:
{"questions": [{"number": "1", "subpart": null, "text": "...", "marks": null}, {"number": "11", "subpart": "a", "text": "...", "marks": "5"}]}

OCR text:
"""
{{TEXT}}
"""`;

export async function structureQuestions(pages: OcrPage[]): Promise<Question[]> {
  const rawText = reconstructPageText(pages);
  if (!rawText.trim()) {
    throw new Error("No text could be detected on the question paper. Please check the file is legible.");
  }
  const prompt = QUESTION_STRUCTURE_PROMPT.replace("{{TEXT}}", rawText.slice(0, 12000));
  const parsed = await ollamaJson<{ questions: RawQuestion[] }>(prompt);
  const raw = parsed.questions || [];
  if (raw.length === 0) {
    throw new Error("Could not identify any questions on the question paper.");
  }
  return raw.map((q, i) => {
    const number = String(q.number ?? "").trim();
    const subpart = q.subpart ? String(q.subpart).trim().toLowerCase() : null;
    const label = subpart ? `${number} (${subpart})` : number;
    return {
      id: `q-${labelKey(number, subpart)}-${i}`,
      number,
      subpart,
      label,
      text: (q.text || "").trim(),
      order: i,
      maxMarks: parseMarks(q.marks),
    } satisfies Question;
  });
}

const DEFAULT_MAX_MARKS = 2;

function parseMarks(raw: string | null | undefined): number {
  if (!raw) return DEFAULT_MAX_MARKS;
  const match = String(raw).match(/\d+(\.\d+)?/);
  if (!match) return DEFAULT_MAX_MARKS;
  const n = parseFloat(match[0]);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_MARKS;
}

// ---------------------------------------------------------------------
// Step 2: answer sheet -> transcribed answer blocks with bounding boxes
// ---------------------------------------------------------------------

const TRANSCRIBE_PROMPT = `This is a cropped region from a student's handwritten exam answer sheet. Transcribe the handwritten text exactly as written, as plain text. Keep line breaks where they naturally occur. Do not answer the question, summarize, or add any commentary - transcribe only. If a word or phrase is truly illegible, write [illegible] in its place. If the crop contains no readable handwriting at all, respond with exactly: [empty]`;

async function cropBase64(pageImageDataUrl: string, bbox: [number, number, number, number], width: number, height: number): Promise<string> {
  const base64 = pageImageDataUrl.split(",")[1] || "";
  const buf = Buffer.from(base64, "base64");
  const pad = 0.01; // small padding so we don't clip ascenders/descenders
  const x0 = Math.max(0, Math.floor((bbox[0] - pad) * width));
  const y0 = Math.max(0, Math.floor((bbox[1] - pad) * height));
  const x1 = Math.min(width, Math.ceil((bbox[2] + pad) * width));
  const y1 = Math.min(height, Math.ceil((bbox[3] + pad) * height));
  const w = Math.max(1, x1 - x0);
  const h = Math.max(1, y1 - y0);
  const cropped = await sharp(buf).extract({ left: x0, top: y0, width: w, height: h }).png().toBuffer();
  return cropped.toString("base64");
}

export async function extractAnswerBlocks(
  pages: OcrPage[],
  jobId: string,
  progressStart: number,
  progressEnd: number,
): Promise<AnswerBlock[]> {
  const allBlocks: { page: number; block: OcrPage["blocks"][number] }[] = [];
  pages.forEach((p, pageIdx) => p.blocks.forEach((b) => allBlocks.push({ page: pageIdx, block: b })));

  const results: AnswerBlock[] = [];
  for (let i = 0; i < allBlocks.length; i++) {
    const { page, block } = allBlocks[i];
    const pageMeta = pages[page];
    const pct = progressStart + ((progressEnd - progressStart) * (i + 1)) / Math.max(1, allBlocks.length);
    report(jobId, `Reading handwriting: block ${i + 1} of ${allBlocks.length}`, Math.round(pct));
    let text = "";
    try {
      const cropped = await cropBase64(pageMeta.image, block.bbox as [number, number, number, number], pageMeta.width, pageMeta.height);
      const transcription = await ollamaVisionText(TRANSCRIBE_PROMPT, cropped);
      text = transcription.replace(/^\[empty\]$/i, "").trim();
    } catch (err) {
      text = `[transcription failed: ${(err as Error).message}]`;
    }
    results.push({
      id: `ans-p${page}-${block.id}`,
      page,
      bbox: block.bbox as [number, number, number, number],
      text,
      ocrHint: block.textHint,
      detectedLabel: detectLabel(text || block.textHint),
    });
  }
  return results;
}

// ---------------------------------------------------------------------
// Step 3: mapping answers -> questions
// ---------------------------------------------------------------------

interface SemanticMatch {
  questionId: string;
  blockId: string;
  confidence: number;
}

const SEMANTIC_MATCH_PROMPT = `You are matching a student's unlabelled handwritten answer fragments to the exam questions they most likely answer. Only propose a match if the content plausibly answers that question - it is fine, and expected, to leave some questions or fragments unmatched.

Questions (id, text):
{{QUESTIONS}}

Answer fragments (id, transcribed text):
{{BLOCKS}}

Respond with ONLY a JSON object: {"matches": [{"questionId": "...", "blockId": "...", "confidence": 0.0-1.0}]}. Omit anything you are not reasonably confident about (confidence < 0.5).`;

export async function mapAnswersToQuestions(
  questions: Question[],
  blocks: AnswerBlock[],
): Promise<{ mapping: MappingEntry[]; unmatchedAnswerBlockIds: string[] }> {
  const mapping = new Map<string, MappingEntry>();
  for (const q of questions) {
    mapping.set(q.id, {
      questionId: q.id,
      answerBlockIds: [],
      status: "unanswered",
      outOfOrder: false,
      matchMethod: "none",
      confidence: 0,
    });
  }

  const consumedBlockIds = new Set<string>();
  const byLabel = new Map<string, Question>();
  for (const q of questions) byLabel.set(labelKey(q.number, q.subpart), q);

  // Sort blocks in reading order (page, then vertical position) so the
  // continuation heuristic below walks the sheet the way a person would.
  const orderedBlocks = [...blocks].sort((a, b) => a.page - b.page || a.bbox[1] - b.bbox[1]);

  // Pass 1: direct label matches (handles out-of-order answers correctly,
  // since we match by label rather than physical position).
  for (const block of orderedBlocks) {
    const label = block.detectedLabel as DetectedLabel | null;
    if (label) {
      const match = byLabel.get(labelKey(label.number, label.subpart)) || byLabel.get(labelKey(label.number, null));
      if (match) {
        const entry = mapping.get(match.id)!;
        entry.answerBlockIds.push(block.id);
        entry.status = "answered";
        entry.matchMethod = "label";
        entry.confidence = Math.max(entry.confidence, 0.9);
        consumedBlockIds.add(block.id);
      }
    }
  }

  // Pass 2: an unlabelled block at the very START of a page is treated as
  // a continuation of whichever question's answer was still "open" at the
  // end of the PREVIOUS page - this is what lets an answer span multiple
  // pages. We deliberately do NOT chain unlabelled blocks within the same
  // page (only across a page break): a stray unlabelled note sitting
  // between two labelled answers on the same page is exactly the "answer
  // that doesn't match any question" case we need to preserve, not
  // something to silently absorb into whichever question came before it.
  const owningQuestionOf = (blockId: string): string | null => {
    for (const [qId, entry] of mapping) {
      if (entry.answerBlockIds.includes(blockId)) return qId;
    }
    return null;
  };
  const blocksByPage = new Map<number, AnswerBlock[]>();
  for (const b of orderedBlocks) {
    if (!blocksByPage.has(b.page)) blocksByPage.set(b.page, []);
    blocksByPage.get(b.page)!.push(b);
  }
  const pageNumbers = [...blocksByPage.keys()].sort((a, b) => a - b);
  for (let pi = 1; pi < pageNumbers.length; pi++) {
    const prevPageBlocks = blocksByPage.get(pageNumbers[pi - 1])!;
    const lastOfPrevPage = prevPageBlocks[prevPageBlocks.length - 1];
    if (!consumedBlockIds.has(lastOfPrevPage.id)) continue; // page didn't end mid-answer
    const openQuestionId = owningQuestionOf(lastOfPrevPage.id);
    if (!openQuestionId) continue;
    for (const block of blocksByPage.get(pageNumbers[pi])!) {
      if (block.detectedLabel) break; // a new labelled answer starts - stop absorbing
      if (consumedBlockIds.has(block.id)) continue;
      if (!block.text || block.text.trim().length === 0) continue;
      const entry = mapping.get(openQuestionId)!;
      entry.answerBlockIds.push(block.id);
      entry.matchMethod = entry.matchMethod === "label" ? "label-continuation" : entry.matchMethod;
      entry.confidence = Math.max(entry.confidence * 0.9, 0.6);
      consumedBlockIds.add(block.id);
    }
  }

  // Pass 3: semantic fallback for whatever's left, via the LLM.
  const remainingQuestions = questions.filter((q) => mapping.get(q.id)!.answerBlockIds.length === 0);
  const remainingBlocks = blocks.filter((b) => !consumedBlockIds.has(b.id) && b.text && b.text.trim().length > 0);
  if (remainingQuestions.length > 0 && remainingBlocks.length > 0) {
    try {
      const prompt = SEMANTIC_MATCH_PROMPT
        .replace("{{QUESTIONS}}", JSON.stringify(remainingQuestions.map((q) => ({ id: q.id, text: `${q.label}: ${q.text}` }))))
        .replace("{{BLOCKS}}", JSON.stringify(remainingBlocks.map((b) => ({ id: b.id, text: b.text.slice(0, 800) }))));
      const result = await ollamaJson<{ matches: SemanticMatch[] }>(prompt);
      for (const m of result.matches || []) {
        if (consumedBlockIds.has(m.blockId)) continue;
        const entry = mapping.get(m.questionId);
        if (!entry) continue;
        entry.answerBlockIds.push(m.blockId);
        entry.status = "answered";
        entry.matchMethod = "semantic";
        entry.confidence = Math.max(entry.confidence, m.confidence ?? 0.5);
        consumedBlockIds.add(m.blockId);
      }
    } catch {
      // Semantic matching is a best-effort enhancement - if the model
      // misbehaves here we simply fall back to leaving things unmatched
      // rather than failing the whole job.
    }
  }

  for (const entry of mapping.values()) {
    if (entry.answerBlockIds.length > 0) entry.status = "answered";
  }

  const unmatchedAnswerBlockIds = blocks
    .filter((b) => !consumedBlockIds.has(b.id) && b.text && b.text.trim().length > 0)
    .map((b) => b.id);

  // Out-of-order detection: for answered questions in printed order, flag
  // any whose earliest answer block appears *before* an earlier-numbered
  // question's answer that comes later physically.
  const blockPosition = new Map<string, number>();
  blocks.forEach((b) => blockPosition.set(b.id, b.page * 100000 + b.bbox[1]));
  const answeredInPrintedOrder = questions
    .filter((q) => mapping.get(q.id)!.status === "answered")
    .sort((a, b) => a.order - b.order);
  let prevPosition = -Infinity;
  for (const q of answeredInPrintedOrder) {
    const entry = mapping.get(q.id)!;
    const earliest = Math.min(...entry.answerBlockIds.map((id) => blockPosition.get(id) ?? Infinity));
    // Flag only when this question's answer physically precedes the answer
    // to the question immediately before it in printed order - i.e. the
    // student jumped ahead and answered this one first. Comparing against
    // the immediate predecessor (rather than a running max) avoids one
    // early jump cascading into false flags on every question after it.
    if (earliest < prevPosition) entry.outOfOrder = true;
    prevPosition = earliest;
  }

  return { mapping: Array.from(mapping.values()), unmatchedAnswerBlockIds };
}

// ---------------------------------------------------------------------
// Step 4: grading (optional scope, on by default - best-effort, no key)
// ---------------------------------------------------------------------

interface GradingItem {
  id: string;
  correctness: Grading["correctness"];
  score: number;
  feedback: string;
}

const GRADING_PROMPT = `You are helping a teacher review a student's exam answers. No official answer key was supplied, so use your own subject-matter knowledge to judge each answer as fairly and consistently as you can. If a question is subjective/opinion-based or you genuinely cannot judge it, use correctness "ungraded" and say why in the feedback.

Each item shows the marks that question is worth ("maxMarks"). Award a score between 0 and maxMarks (it does not need to be a whole number), matching correctness to how much of that credit the answer earns: "correct" for full or near-full marks, "partially_correct" for partial credit, "incorrect" for 0 (or close to 0). Give 1-2 sentences of specific feedback per item.

Items:
{{ITEMS}}

Respond with ONLY JSON: {"items": [{"id": "...", "correctness": "...", "score": 0, "feedback": "..."}], "overallFeedback": "1-3 sentence summary of overall performance"}`;

export async function gradeAnswers(
  questions: Question[],
  blocks: AnswerBlock[],
  mapping: MappingEntry[],
): Promise<{ mapping: MappingEntry[]; overallFeedback: string | null }> {
  const blockById = new Map(blocks.map((b) => [b.id, b]));
  const answered = mapping.filter((m) => m.status === "answered");
  if (answered.length === 0) {
    return { mapping, overallFeedback: "No answers were matched to any question, so nothing could be graded." };
  }
  const items = answered.map((m) => {
    const q = questions.find((qq) => qq.id === m.questionId)!;
    const answerText = m.answerBlockIds
      .map((id) => blockById.get(id)?.text || "")
      .filter(Boolean)
      .join("\n");
    return {
      id: q.id,
      question: `${q.label}: ${q.text}`,
      maxMarks: q.maxMarks,
      answer: answerText.slice(0, 2000) || "(no legible text)",
    };
  });

  try {
    const prompt = GRADING_PROMPT.replace("{{ITEMS}}", JSON.stringify(items));
    const result = await ollamaJson<{ items: GradingItem[]; overallFeedback: string }>(prompt);
    const byId = new Map((result.items || []).map((g) => [g.id, g]));
    const maxMarksById = new Map(questions.map((q) => [q.id, q.maxMarks]));
    for (const m of mapping) {
      const g = byId.get(m.questionId);
      if (g) {
        const maxMarks = maxMarksById.get(m.questionId) ?? DEFAULT_MAX_MARKS;
        const score = Math.max(0, Math.min(Number(g.score) || 0, maxMarks));
        m.grading = { correctness: g.correctness || "ungraded", score, feedback: g.feedback || "" };
      }
    }
    return { mapping, overallFeedback: result.overallFeedback || null };
  } catch (err) {
    // Grading is bonus scope - degrade gracefully rather than failing the job.
    for (const m of mapping) {
      if (m.status === "answered" && !m.grading) {
        m.grading = { correctness: "ungraded", score: 0, feedback: `Grading unavailable: ${(err as Error).message}` };
      }
    }
    return { mapping, overallFeedback: "Automated grading could not complete for this submission." };
  }
}

// ---------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------

export async function runPipeline(jobId: string, questionFile: File, answerFile: File): Promise<ProcessResult> {
  report(jobId, "Reading question paper...", 5);
  const questionDoc = await ingestDocument(questionFile);

  report(jobId, "Reading answer sheet...", 15);
  const answerDoc = await ingestDocument(answerFile);

  report(jobId, "Extracting questions...", 25);
  const questions = await structureQuestions(questionDoc.pages);

  const blocks = await extractAnswerBlocks(answerDoc.pages, jobId, 30, 75);

  report(jobId, "Matching answers to questions...", 80);
  const { mapping, unmatchedAnswerBlockIds } = await mapAnswersToQuestions(questions, blocks);

  report(jobId, "Grading answers...", 90);
  const { mapping: gradedMapping, overallFeedback } = await gradeAnswers(questions, blocks, mapping);

  report(jobId, "Finishing up...", 98);
  const answered = gradedMapping.filter((m) => m.status === "answered").length;
  const outOfOrder = gradedMapping.filter((m) => m.outOfOrder).length;
  const graded = gradedMapping.filter((m) => m.grading && m.grading.correctness !== "ungraded");
  const marksPossible = graded.length > 0 ? questions.filter((q) => graded.some((m) => m.questionId === q.id)).reduce((sum, q) => sum + q.maxMarks, 0) : null;
  const marksAwarded = graded.length > 0 ? graded.reduce((sum, m) => sum + (m.grading?.score ?? 0), 0) : null;

  const result: ProcessResult = {
    questions,
    answerBlocks: blocks,
    mapping: gradedMapping,
    unmatchedAnswerBlockIds,
    answerPages: answerDoc.pages.map((p) => ({ pageIndex: p.pageIndex, image: p.image, width: p.width, height: p.height })),
    summary: {
      totalQuestions: questions.length,
      answered,
      unanswered: questions.length - answered,
      outOfOrder,
      unmatchedAnswers: unmatchedAnswerBlockIds.length,
      marksAwarded,
      marksPossible,
      overallFeedback,
    },
  };
  return result;
}
