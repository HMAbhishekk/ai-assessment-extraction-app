// Shared types for the extraction / mapping / grading pipeline.
// Everything lives in server memory for the lifetime of the job - no DB,
// per the assignment's constraints.

export interface OcrLine {
  bbox: [number, number, number, number]; // normalized x0,y0,x1,y1
  text: string;
  confidence: number;
}

export interface OcrBlock {
  id: string;
  bbox: [number, number, number, number];
  textHint: string;
  lineCount: number;
}

export interface OcrPage {
  pageIndex: number;
  width: number;
  height: number;
  image: string; // data URL
  lines: OcrLine[];
  blocks: OcrBlock[];
}

export interface Question {
  id: string;
  number: string; // printed number, e.g. "11"
  subpart: string | null; // e.g. "a"
  label: string; // e.g. "11 (a)" or just "3"
  text: string;
  order: number;
  maxMarks: number; // parsed from the paper when shown (e.g. "[5]"), else a sensible default
}

export interface AnswerBlock {
  id: string;
  page: number;
  bbox: [number, number, number, number];
  text: string; // vision-LLM transcription (primary source of truth)
  ocrHint: string; // raw EasyOCR text, kept for debugging/fallback
  detectedLabel: { number: string; subpart: string | null } | null;
}

export type MatchMethod = "label" | "label-continuation" | "semantic" | "none";

export interface Grading {
  correctness: "correct" | "partially_correct" | "incorrect" | "ungraded";
  score: number; // marks awarded, out of the question's maxMarks
  feedback: string;
}

export interface MappingEntry {
  questionId: string;
  answerBlockIds: string[];
  status: "answered" | "unanswered";
  outOfOrder: boolean; // answered, but physically out of printed-question order
  matchMethod: MatchMethod;
  confidence: number; // 0-1
  grading?: Grading;
}

export interface AnswerPageMeta {
  pageIndex: number;
  image: string;
  width: number;
  height: number;
}

export interface ProcessResult {
  questions: Question[];
  answerBlocks: AnswerBlock[];
  mapping: MappingEntry[];
  unmatchedAnswerBlockIds: string[];
  answerPages: AnswerPageMeta[];
  summary: {
    totalQuestions: number;
    answered: number;
    unanswered: number;
    outOfOrder: number;
    unmatchedAnswers: number;
    marksAwarded: number | null;
    marksPossible: number | null;
    overallFeedback: string | null;
  };
}

export type JobStatus = "pending" | "processing" | "done" | "error";

export interface JobState {
  id: string;
  status: JobStatus;
  step: string;
  progress: number; // 0-100
  error?: string;
  result?: ProcessResult;
  createdAt: number;
}
