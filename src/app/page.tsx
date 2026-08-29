"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { JobState } from "@/lib/types";
import AppShell from "@/components/AppShell";
import UploadForm from "@/components/UploadForm";
import ProcessingView from "@/components/ProcessingView";
import ResultsView from "@/components/ResultsView";
import SettingsPanel from "@/components/SettingsPanel";
import SectionPlaceholder from "@/components/SectionPlaceholder";
import { AlertTriangleIcon } from "@/components/icons";
import { SECTION_META, type NavSectionId, type Section } from "@/components/navSections";

type Screen = "upload" | "processing" | "results" | "error";

const PLACEHOLDER_COPY: Record<Exclude<NavSectionId, "exams">, string> = {
  home: "Your daily overview - upcoming exams, recent activity, and quick actions - would live here.",
  classroom: "Manage your classes, students, and rosters here.",
  assignments: "Create, assign, and track non-exam coursework here.",
  library: "Saved resources, templates, and past exports would live here.",
};

export default function Home() {
  const [activeSection, setActiveSection] = useState<Section>("exams");
  const [screen, setScreen] = useState<Screen>("upload");
  const [job, setJob] = useState<JobState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notificationSeen, setNotificationSeen] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollJob = useCallback(
    (jobId: string) => {
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/process/${jobId}`);
          const data: JobState = await res.json();
          setJob(data);
          if (data.status === "done") {
            stopPolling();
            setScreen("results");
            setNotificationSeen(false);
          } else if (data.status === "error") {
            stopPolling();
            setErrorMsg(data.error || "Something went wrong while processing.");
            setScreen("error");
          }
        } catch {
          // transient network hiccup while polling - keep trying
        }
      }, 1200);
    },
    [stopPolling],
  );

  const handleSubmit = useCallback(
    async (questionFile: File, answerFile: File) => {
      setErrorMsg(null);
      setScreen("processing");
      setJob({ id: "", status: "pending", step: "Uploading files...", progress: 0, createdAt: Date.now() });
      try {
        const form = new FormData();
        form.append("questionFile", questionFile);
        form.append("answerFile", answerFile);
        const res = await fetch("/api/process", { method: "POST", body: form });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Upload failed (${res.status})`);
        }
        const { jobId } = await res.json();
        pollJob(jobId);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setScreen("error");
      }
    },
    [pollJob],
  );

  const reset = useCallback(() => {
    stopPolling();
    setJob(null);
    setErrorMsg(null);
    setScreen("upload");
  }, [stopPolling]);

  const startNewMapping = useCallback(() => {
    setActiveSection("exams");
    reset();
  }, [reset]);

  const dismissNotification = useCallback(() => setNotificationSeen(true), []);

  const notificationText = useMemo(() => {
    if (job?.status !== "done" || !job.result) return null;
    const { summary } = job.result;
    return `Extraction finished - ${summary.answered}/${summary.totalQuestions} questions answered${
      summary.unmatchedAnswers > 0 ? `, ${summary.unmatchedAnswers} unmatched answer(s)` : ""
    }.`;
  }, [job]);

  const hasNotification = job?.status === "done" && !notificationSeen;

  const handleBack =
    activeSection !== "exams" ? () => setActiveSection("exams") : screen !== "upload" ? reset : undefined;

  return (
    <AppShell
      sidebarCollapsed={activeSection === "exams" && screen === "results"}
      onBack={handleBack}
      activeSection={activeSection}
      onNavigate={setActiveSection}
      onOpenSettings={() => setActiveSection("settings")}
      onNewMapping={startNewMapping}
      hasNotification={hasNotification}
      onDismissNotification={dismissNotification}
      notificationText={notificationText}
    >
      {activeSection === "settings" && <SettingsPanel />}

      {activeSection !== "exams" && activeSection !== "settings" && (
        <SectionPlaceholder
          title={SECTION_META[activeSection].label}
          description={PLACEHOLDER_COPY[activeSection]}
          icon={SECTION_META[activeSection].icon}
          onGoToExams={() => setActiveSection("exams")}
        />
      )}

      {activeSection === "exams" && (
        <>
          {screen === "upload" && <UploadForm onSubmit={handleSubmit} />}
          {screen === "processing" && <ProcessingView job={job} />}
          {screen === "error" && (
            <div className="flex flex-1 items-center justify-center px-6 py-16">
              <div className="w-full max-w-sm rounded-2xl border border-red-100 bg-red-50/60 p-6 text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-500">
                  <AlertTriangleIcon className="h-5 w-5" />
                </div>
                <h2 className="mt-3 text-[15px] font-bold text-zinc-900">Processing failed</h2>
                <p className="mt-1.5 text-[13px] text-zinc-500">{errorMsg}</p>
                <button
                  onClick={reset}
                  className="mt-5 rounded-full bg-zinc-900 px-4 py-2 text-[13px] font-semibold text-white hover:bg-zinc-800"
                >
                  Try again
                </button>
              </div>
            </div>
          )}
          {screen === "results" && job?.result && <ResultsView result={job.result} />}
        </>
      )}
    </AppShell>
  );
}
