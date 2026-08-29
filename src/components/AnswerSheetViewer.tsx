"use client";

import { useMemo, useState } from "react";
import type { AnswerBlock, AnswerPageMeta } from "@/lib/types";
import { ChevronLeftIcon, ChevronRightSmallIcon, ZoomInIcon, ZoomOutIcon } from "./icons";

const MIN_ZOOM = 60;
const MAX_ZOOM = 200;
const ZOOM_STEP = 10;
const BASE_WIDTH = 640;

export default function AnswerSheetViewer({
  answerPages,
  answerBlocks,
  selectedBlockIds,
  selectedLabel,
  className,
}: {
  answerPages: AnswerPageMeta[];
  answerBlocks: AnswerBlock[];
  selectedBlockIds: string[];
  selectedLabel: string | null;
  className?: string;
}) {
  const [zoom, setZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(0);

  const blockById = useMemo(() => new Map(answerBlocks.map((b) => [b.id, b])), [answerBlocks]);

  const selectedPages = useMemo(() => {
    const pages = new Set<number>();
    for (const id of selectedBlockIds) {
      const b = blockById.get(id);
      if (b) pages.add(b.page);
    }
    return Array.from(pages).sort((a, b) => a - b);
  }, [selectedBlockIds, blockById]);

  const selectedFirstPage = selectedPages.length > 0 ? selectedPages[0] : null;

  // Jump to the page containing the newly-selected answer. Comparing against
  // the previous first-page value (rather than an effect) keeps this a
  // render-time state adjustment instead of a cascading post-commit update.
  const [prevFirstPage, setPrevFirstPage] = useState<number | null>(selectedFirstPage);
  if (selectedFirstPage !== prevFirstPage) {
    setPrevFirstPage(selectedFirstPage);
    if (selectedFirstPage !== null) setCurrentPage(selectedFirstPage);
  }

  const page = answerPages[currentPage];
  const pageBlocks = useMemo(() => answerBlocks.filter((b) => b.page === currentPage), [answerBlocks, currentPage]);
  const highlightedIds = useMemo(() => new Set(selectedBlockIds), [selectedBlockIds]);

  return (
    <div className={`flex h-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white ${className ?? ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-900 px-4 py-2.5 text-white">
        <span className="text-[13px] font-bold">Answer Sheet</span>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-full bg-white/10 px-1 py-1">
            <button
              onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
              className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-300 hover:bg-white/10 hover:text-white"
              aria-label="Zoom out"
            >
              <ZoomOutIcon className="h-3.5 w-3.5" />
            </button>
            <span className="w-9 text-center text-[11.5px] font-medium tabular-nums">{zoom}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
              className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-300 hover:bg-white/10 hover:text-white"
              aria-label="Zoom in"
            >
              <ZoomInIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          {answerPages.length > 1 && (
            <div className="flex items-center gap-1 text-[11.5px] font-medium text-zinc-300">
              <button
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/10 hover:text-white disabled:opacity-30"
                aria-label="Previous page"
              >
                <ChevronLeftIcon className="h-3.5 w-3.5" />
              </button>
              <span className="tabular-nums">
                Page {currentPage + 1} of {answerPages.length}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(answerPages.length - 1, p + 1))}
                disabled={currentPage === answerPages.length - 1}
                className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/10 hover:text-white disabled:opacity-30"
                aria-label="Next page"
              >
                <ChevronRightSmallIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {selectedPages.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-100 bg-zinc-50 px-4 py-2 text-[11.5px] text-zinc-500">
          <span>This answer also appears on:</span>
          {selectedPages
            .filter((p) => p !== currentPage)
            .map((p) => (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 font-medium text-zinc-600 hover:border-brand-300 hover:text-brand-600"
              >
                Page {p + 1}
              </button>
            ))}
        </div>
      )}

      <div className="no-scrollbar flex-1 overflow-auto bg-zinc-100 p-4">
        {page ? (
          <div className="mx-auto" style={{ width: `${(zoom / 100) * BASE_WIDTH}px`, maxWidth: "100%" }}>
            <div className="relative bg-white shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={page.image}
                alt={`Answer sheet page ${currentPage + 1}`}
                className="block w-full select-none"
                draggable={false}
              />
              {pageBlocks.map((b) => {
                if (!highlightedIds.has(b.id)) return null;
                return <BlockOverlay key={b.id} block={b} label={selectedLabel} />;
              })}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-[13px] text-zinc-400">
            No answer sheet pages available.
          </div>
        )}
      </div>
    </div>
  );
}

function BlockOverlay({ block, label }: { block: AnswerBlock; label: string | null }) {
  const [x0, y0, x1, y1] = block.bbox;
  return (
    <div
      style={{
        position: "absolute",
        left: `${x0 * 100}%`,
        top: `${y0 * 100}%`,
        width: `${(x1 - x0) * 100}%`,
        height: `${(y1 - y0) * 100}%`,
      }}
      className="animate-fade-in-up rounded-sm border-2 border-emerald-500 bg-emerald-400/10 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]"
    >
      {label && (
        <span className="absolute -top-2.5 left-1.5 whitespace-nowrap rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9.5px] font-bold leading-none text-white shadow-sm">
          {label}
        </span>
      )}
    </div>
  );
}
