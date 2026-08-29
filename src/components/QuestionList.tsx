"use client";

import type { AnswerBlock, MappingEntry, Question } from "@/lib/types";
import { AlertTriangleIcon, ChevronDownIcon } from "./icons";

export type Selection = { type: "question"; id: string } | { type: "unmatched"; id: string } | null;

function scoreTone(score: number, maxMarks: number): { pill: string; ratio: number } {
  const ratio = maxMarks > 0 ? score / maxMarks : 0;
  if (ratio >= 0.7) return { pill: "bg-emerald-50 text-emerald-600", ratio };
  if (ratio > 0) return { pill: "bg-amber-50 text-amber-600", ratio };
  return { pill: "bg-red-50 text-red-500", ratio };
}

function formatScore(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function QuestionRow({
  question,
  mapping,
  selected,
  expanded,
  onSelect,
}: {
  question: Question;
  mapping: MappingEntry;
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
}) {
  const answered = mapping.status === "answered";
  const grading = mapping.grading;
  const badgeText = question.subpart ? `${question.number}${question.subpart}` : question.number;

  return (
    <div
      className={`animate-fade-in-up rounded-xl border bg-white transition-colors ${
        selected ? "border-brand-400 shadow-sm" : "border-zinc-200 hover:border-zinc-300"
      }`}
    >
      <button onClick={onSelect} className="flex w-full items-start gap-3 p-3 text-left">
        <span
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
            selected ? "bg-brand-500 text-white" : "bg-zinc-800 text-white"
          }`}
        >
          {badgeText}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-[13px] leading-snug text-zinc-800 ${expanded ? "" : "line-clamp-2"}`}>{question.text}</p>
            <div className="flex shrink-0 items-center gap-1.5">
              {answered && grading && grading.correctness !== "ungraded" && (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${scoreTone(grading.score, question.maxMarks).pill}`}>
                  {formatScore(grading.score)}/{formatScore(question.maxMarks)}
                </span>
              )}
              {answered && grading && grading.correctness === "ungraded" && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500">Ungraded</span>
              )}
              {!answered && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-400">Not answered</span>}
              <ChevronDownIcon className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </div>
          </div>

          {mapping.outOfOrder && (
            <span className="mt-1.5 inline-block rounded-full bg-sky-50 px-2 py-0.5 text-[10.5px] font-medium text-sky-600">
              Answered out of order
            </span>
          )}

          {expanded && (
            <div className="mt-3 border-t border-zinc-100 pt-3">
              {answered && grading ? (
                <>
                  <p className="text-[11.5px] font-bold text-zinc-700">AI Feedback</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-500">{grading.feedback}</p>
                </>
              ) : (
                <p className="text-[12.5px] italic text-zinc-400">No answer was found for this question on the answer sheet.</p>
              )}
            </div>
          )}
        </div>
      </button>
    </div>
  );
}

export default function QuestionList({
  questions,
  mappingByQuestion,
  blockById,
  unmatchedIds,
  selection,
  expandedId,
  onSelect,
}: {
  questions: Question[];
  mappingByQuestion: Map<string, MappingEntry>;
  blockById: Map<string, AnswerBlock>;
  unmatchedIds: string[];
  selection: Selection;
  expandedId: string | null;
  onSelect: (s: Selection, expand?: boolean) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-0.5 pb-3">
        <h2 className="text-[13px] font-bold text-zinc-800">Extracted Questions (from question paper)</h2>
        <button
          onClick={() => {
            const q = questions[0];
            if (q) onSelect({ type: "question", id: q.id }, expandedId === null);
          }}
          className="rounded-full border border-zinc-200 px-3 py-1 text-[11.5px] font-medium text-zinc-500 hover:bg-zinc-50"
        >
          {expandedId === null ? "Expand All" : "Collapse"}
        </button>
      </div>

      <div className="no-scrollbar flex-1 space-y-2 overflow-y-auto pb-2 pr-1">
        {questions.map((q) => (
          <QuestionRow
            key={q.id}
            question={q}
            mapping={mappingByQuestion.get(q.id)!}
            selected={selection?.type === "question" && selection.id === q.id}
            expanded={expandedId === q.id || expandedId === "__all__"}
            onSelect={() => onSelect({ type: "question", id: q.id }, undefined)}
          />
        ))}

        {unmatchedIds.length > 0 && (
          <div className="pt-3">
            <div className="mb-2 flex items-center gap-1.5 text-[12px] font-bold text-amber-600">
              <AlertTriangleIcon className="h-3.5 w-3.5" />
              Answers that don&apos;t match any question ({unmatchedIds.length})
            </div>
            <div className="space-y-2">
              {unmatchedIds.map((id) => {
                const block = blockById.get(id);
                if (!block) return null;
                const selected = selection?.type === "unmatched" && selection.id === id;
                return (
                  <button
                    key={id}
                    onClick={() => onSelect({ type: "unmatched", id })}
                    className={`w-full rounded-xl border p-3 text-left text-[12.5px] transition-colors ${
                      selected ? "border-amber-400 bg-amber-50/60" : "border-zinc-200 bg-white hover:border-zinc-300"
                    }`}
                  >
                    <span className="font-medium text-zinc-400">Page {block.page + 1}: </span>
                    <span className="text-zinc-600">{block.text || "(no legible text)"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
