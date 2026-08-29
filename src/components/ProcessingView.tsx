"use client";

import type { JobState } from "@/lib/types";
import { SparkleIcon } from "./icons";

export default function ProcessingView({ job }: { job: JobState | null }) {
  const progress = job?.progress ?? 0;
  const step = job?.step || "Starting...";

  return (
    <div className="hero-glow flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 animate-pulse-glow rounded-full bg-brand-100" />
        <SparkleIcon className="relative h-9 w-9 text-brand-500" />
      </div>

      <h2 className="mt-5 text-[19px] font-bold text-zinc-900">Extracting&hellip;</h2>
      <p className="mt-1 text-[13.5px] text-zinc-500">{step}</p>

      <div className="mt-6 h-1.5 w-56 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-brand-500 transition-all duration-500 ease-out"
          style={{ width: `${Math.max(4, progress)}%` }}
        />
      </div>
      <p className="mt-6 max-w-xs text-[12px] text-zinc-400">
        This may take a while - handwriting is read carefully, block by block, on a local model.
      </p>
    </div>
  );
}
