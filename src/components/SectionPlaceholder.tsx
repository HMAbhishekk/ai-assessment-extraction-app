"use client";

import type { ComponentType } from "react";
import { ArrowRightIcon } from "./icons";

export default function SectionPlaceholder({
  title,
  description,
  icon: Icon,
  onGoToExams,
}: {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  onGoToExams: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-[16px] font-bold text-zinc-900">{title}</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">{description}</p>
        <p className="mt-3 text-[12px] text-zinc-400">
          This section is part of the VedaAI product shell shown in the design, but it&apos;s outside the scope of this
          assessment-extraction demo.
        </p>
        <button
          onClick={onGoToExams}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-[13px] font-semibold text-white hover:bg-zinc-800"
        >
          Go to Exams
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
