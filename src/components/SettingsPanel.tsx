"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangleIcon, CheckCircleIcon, RefreshIcon } from "./icons";

interface HealthState {
  ok: boolean;
  ollama: boolean;
  ocrService: boolean;
  model: string;
}

function StatusRow({ label, detail, ok }: { label: string; detail: string; ok: boolean | null }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3">
      <div>
        <p className="text-[13px] font-semibold text-zinc-800">{label}</p>
        <p className="text-[11.5px] text-zinc-400">{detail}</p>
      </div>
      {ok === null ? (
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-400">Checking…</span>
      ) : ok ? (
        <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-600">
          <CheckCircleIcon className="h-3.5 w-3.5" />
          Connected
        </span>
      ) : (
        <span className="flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-500">
          <AlertTriangleIcon className="h-3.5 w-3.5" />
          Unreachable
        </span>
      )}
    </div>
  );
}

export default function SettingsPanel() {
  const [health, setHealth] = useState<HealthState | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // No leading setState call here (loading/error already default to the
  // right values for a first check) so this can be invoked directly from
  // the mount effect below without synchronously updating state from
  // within the effect body.
  const runCheck = useCallback(async () => {
    try {
      const res = await fetch("/api/health");
      const data: HealthState = await res.json();
      setHealth(data);
      setCheckedAt(new Date());
    } catch {
      setError("Could not reach the app's own health endpoint - the server may still be starting up.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Genuine fetch-on-mount (an external system, per the rule's own
    // guidance) - runCheck only touches state after its `await`, never
    // synchronously during this call. The lint rule can't see across that
    // await boundary, so it flags this as if it always would.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    runCheck();
  }, [runCheck]);

  // The manual refresh button resets loading/error synchronously before
  // re-running the same check - fine here since it's a plain event handler,
  // not part of an effect's render-time call graph.
  const handleRefresh = () => {
    setLoading(true);
    setError(null);
    runCheck();
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6">
      <h1 className="text-[19px] font-bold text-zinc-900">Settings</h1>
      <p className="mt-1 text-[13px] text-zinc-500">
        This demo has no user accounts or configurable options - what&apos;s below is a live read of the backend services
        this app depends on, pulled from its own <code className="rounded bg-zinc-100 px-1 py-0.5 text-[11.5px]">/api/health</code> endpoint.
      </p>

      <div className="mt-6 space-y-2.5">
        <StatusRow
          label="Ollama (local AI model)"
          detail={health ? `Model: ${health.model}` : "Handwriting transcription, question structuring, matching, grading"}
          ok={health ? health.ollama : null}
        />
        <StatusRow
          label="OCR microservice"
          detail="Line/block detection for the answer sheet (EasyOCR + PyMuPDF)"
          ok={health ? health.ocrService : null}
        />
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50/60 px-4 py-3 text-[12.5px] text-red-600">
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between">
        <p className="text-[11.5px] text-zinc-400">
          {checkedAt ? `Last checked ${checkedAt.toLocaleTimeString()}` : "Not checked yet"}
        </p>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 text-[12px] font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
        >
          <RefreshIcon className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>
    </div>
  );
}
