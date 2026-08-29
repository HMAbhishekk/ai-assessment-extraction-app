"use client";

import { useMemo, useState } from "react";
import type { ProcessResult } from "@/lib/types";
import QuestionList, { type Selection } from "./QuestionList";
import AnswerSheetViewer from "./AnswerSheetViewer";
import { AlertTriangleIcon, CheckCircleIcon } from "./icons";

function StatChip({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`flex items-baseline gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium ${tone}`}>
      <span className="text-[13px] font-bold">{value}</span>
      <span className="opacity-80">{label}</span>
    </div>
  );
}

export default function ResultsView({ result }: { result: ProcessResult }) {
  const [selection, setSelection] = useState<Selection>(() =>
    result.questions[0] ? { type: "question", id: result.questions[0].id } : null,
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"questions" | "sheet">("questions");

  const blockById = useMemo(() => new Map(result.answerBlocks.map((b) => [b.id, b])), [result.answerBlocks]);
  const questionById = useMemo(() => new Map(result.questions.map((q) => [q.id, q])), [result.questions]);
  const mappingByQuestion = useMemo(() => new Map(result.mapping.map((m) => [m.questionId, m])), [result.mapping]);

  const handleSelect = (s: Selection, expand?: boolean) => {
    setSelection(s);
    if (expand === true) {
      setExpandedId("__all__");
      return;
    }
    if (expand === false) {
      setExpandedId(null);
      return;
    }
    if (s?.type === "question") {
      setExpandedId((prev) => (prev === s.id || prev === "__all__" ? null : s.id));
    } else {
      setExpandedId(null);
    }
  };

  const selectedBlockIds: string[] = useMemo(() => {
    if (!selection) return [];
    if (selection.type === "unmatched") return [selection.id];
    return mappingByQuestion.get(selection.id)?.answerBlockIds ?? [];
  }, [selection, mappingByQuestion]);

  const selectedLabel = useMemo(() => {
    if (!selection) return null;
    if (selection.type === "unmatched") return "Unmatched";
    const q = questionById.get(selection.id);
    if (!q) return null;
    return q.subpart ? `Q${q.number}(${q.subpart})` : `Q${q.number}`;
  }, [selection, questionById]);

  const { summary } = result;
  const hasMarks = summary.marksPossible != null && summary.marksAwarded != null;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-4 py-3 sm:px-6">
        <h1 className="text-[14.5px] font-bold text-zinc-900">Question ↔ Answer Mapping</h1>
        {hasMarks && (
          <span className="rounded-full bg-zinc-900 px-3 py-1 text-[12px] font-semibold text-white">
            {summary.marksAwarded}/{summary.marksPossible} marks
          </span>
        )}
        <div className="ml-auto flex flex-wrap gap-1.5">
          <StatChip label="answered" value={summary.answered} tone="bg-emerald-50 text-emerald-700" />
          <StatChip label="unanswered" value={summary.unanswered} tone="bg-zinc-100 text-zinc-500" />
          {summary.outOfOrder > 0 && <StatChip label="out of order" value={summary.outOfOrder} tone="bg-sky-50 text-sky-700" />}
          {summary.unmatchedAnswers > 0 && (
            <StatChip label="unmatched" value={summary.unmatchedAnswers} tone="bg-amber-50 text-amber-700" />
          )}
        </div>
      </div>

      {summary.overallFeedback && (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-[12.5px] text-zinc-700 sm:mx-6">
          <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
          <p>
            <span className="font-bold text-zinc-800">Overall: </span>
            {summary.overallFeedback}
          </p>
        </div>
      )}

      <div className="px-4 pt-3 sm:px-6 lg:hidden">
        <div className="inline-flex items-center gap-1 rounded-full bg-zinc-100 p-1">
          <button
            onClick={() => setMobileTab("questions")}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
              mobileTab === "questions" ? "bg-zinc-900 text-white" : "text-zinc-500"
            }`}
          >
            Questions
          </button>
          <button
            onClick={() => setMobileTab("sheet")}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
              mobileTab === "sheet" ? "bg-zinc-900 text-white" : "text-zinc-500"
            }`}
          >
            Answer Sheet
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 sm:p-6 lg:grid-cols-5">
        <div className={`min-h-0 ${mobileTab === "questions" ? "flex" : "hidden"} flex-col lg:col-span-2 lg:flex`}>
          <QuestionList
            questions={result.questions}
            mappingByQuestion={mappingByQuestion}
            blockById={blockById}
            unmatchedIds={result.unmatchedAnswerBlockIds}
            selection={selection}
            expandedId={expandedId}
            onSelect={handleSelect}
          />
        </div>

        <div className={`min-h-[60vh] ${mobileTab === "sheet" ? "flex" : "hidden"} flex-col lg:col-span-3 lg:flex lg:min-h-0`}>
          <AnswerSheetViewer
            answerPages={result.answerPages}
            answerBlocks={result.answerBlocks}
            selectedBlockIds={selectedBlockIds}
            selectedLabel={selectedLabel}
            className="flex-1"
          />
        </div>
      </div>

      {result.unmatchedAnswerBlockIds.length > 0 && result.questions.length === 0 && (
        <div className="flex items-center gap-2 px-6 pb-4 text-[12px] text-amber-600">
          <AlertTriangleIcon className="h-4 w-4" />
          No questions could be extracted from the question paper.
        </div>
      )}
    </div>
  );
}
