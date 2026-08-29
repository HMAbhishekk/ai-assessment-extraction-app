import type { JobState } from "./types";

// In-memory only, per the assignment's constraints (no DB). This means
// jobs are lost on server restart, which is acceptable for a single
// teacher/single-session grading tool.
const jobs = new Map<string, JobState>();

export function createJob(id: string): JobState {
  const job: JobState = {
    id,
    status: "pending",
    step: "Queued",
    progress: 0,
    createdAt: Date.now(),
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): JobState | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, patch: Partial<JobState>): void {
  const existing = jobs.get(id);
  if (!existing) return;
  jobs.set(id, { ...existing, ...patch });
}

// Periodically drop very old jobs so the map doesn't grow unbounded in a
// long-lived process.
const ONE_HOUR = 60 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > ONE_HOUR) jobs.delete(id);
  }
}, 15 * 60 * 1000).unref?.();
