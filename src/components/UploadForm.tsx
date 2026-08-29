"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";
import { ArrowRightIcon, PdfFileIcon, ImageFileIcon, UploadCloudIcon, XIcon } from "./icons";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp";

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function FileCard({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) onChange(f);
    },
    [onChange],
  );

  const isPdf = file && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={() => !file && inputRef.current?.click()}
      className={`relative flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
        file ? "cursor-default border-zinc-200 bg-white" : "cursor-pointer border-zinc-200 bg-white hover:border-brand-300 hover:bg-brand-50/30"
      } ${dragOver ? "border-brand-400 bg-brand-50/50" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />

      {!file ? (
        <>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
            <UploadCloudIcon className="h-4 w-4" />
          </div>
          <p className="mt-3 text-[13.5px] text-zinc-800">
            Upload <span className="font-semibold text-brand-600">{label}</span>
          </p>
          <p className="mt-0.5 text-[11.5px] text-zinc-400">Max 10MB</p>
        </>
      ) : (
        <div className="flex w-full items-center gap-3 rounded-xl bg-zinc-50 p-3 text-left">
          {isPdf ? <PdfFileIcon className="h-9 w-9 shrink-0" /> : <ImageFileIcon className="h-9 w-9 shrink-0" />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-zinc-800">{file.name}</p>
            <p className="text-[11.5px] text-zinc-400">{formatSize(file.size)}</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-white hover:bg-zinc-700"
            aria-label="Remove file"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function Avatar() {
  return (
    <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-brand-100" />
      <span className="absolute -right-0.5 top-1 h-2 w-2 rounded-full bg-brand-400" />
      <span className="absolute -left-1 top-6 h-1.5 w-1.5 rounded-full bg-brand-400" />
      <span className="absolute bottom-0 right-3 h-1.5 w-1.5 rounded-full bg-brand-400" />
      <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-white ring-4 ring-white">
        <svg viewBox="0 0 24 24" className="h-9 w-9 text-zinc-300" fill="currentColor">
          <circle cx="12" cy="8.5" r="4" />
          <path d="M4 20c1-4.2 4-6.2 8-6.2s7 2 8 6.2a1 1 0 0 1-1 1.2H5a1 1 0 0 1-1-1.2Z" />
        </svg>
        <img
          src="/avatar.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      </div>
    </div>
  );
}

export default function UploadForm({
  onSubmit,
}: {
  onSubmit: (questionFile: File, answerFile: File) => void;
}) {
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [answerFile, setAnswerFile] = useState<File | null>(null);

  const canSubmit = !!questionFile && !!answerFile;

  return (
    <div className="hero-glow flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-xl">
        <h1 className="text-center text-[22px] font-bold leading-snug text-zinc-900 sm:text-[26px]">
          Upload{" "}
          <span className="rounded-md bg-brand-100 px-1.5 py-0.5 text-brand-600">Question Paper &amp; Answer Sheets</span>
        </h1>
        <p className="mt-2 text-center text-[13.5px] text-zinc-500">Upload both files to get started</p>

        <div className="mt-6">
          <Avatar />
        </div>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row">
          <FileCard label="Question Paper" file={questionFile} onChange={setQuestionFile} />
          <FileCard label="Answer Sheet" file={answerFile} onChange={setAnswerFile} />
        </div>

        <div className="mt-6 flex justify-center">
          <button
            disabled={!canSubmit}
            onClick={() => canSubmit && onSubmit(questionFile!, answerFile!)}
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-[13.5px] font-semibold shadow-sm transition-colors ${
              canSubmit ? "bg-zinc-900 text-white hover:bg-zinc-800" : "cursor-not-allowed bg-zinc-100 text-zinc-400"
            }`}
          >
            Start Mapping
            <ArrowRightIcon className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 text-center text-[11.5px] text-zinc-400">
          {canSubmit
            ? "Ready when you are - this runs on a local AI model, so the first run after a cold start can take a little longer."
            : "Once both files are uploaded, you'll be able to map answers with questions."}
        </p>
      </div>
    </div>
  );
}
