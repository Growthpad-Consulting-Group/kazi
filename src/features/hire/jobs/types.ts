import type { Job } from "@/types/database";

export type { Job };

export interface RubricItem {
  criterion: string;
  weight: number;
  description: string;
}

export interface JobFormData {
  title: string;
  department: string;
  location: string;
  description: string;
  must_haves: string[];
  nice_to_haves: string[];
  scoring_rubric: RubricItem[];
  shortlist_threshold: number;
  status: "draft" | "open" | "paused";
  published_at: string | null;
  closes_at: string | null;
  employment_type: string;
  work_mode: string;
  contract_duration: string;
  compensation: string;
  reports_to: string;
  benefits: string;
  application_instructions: string;
  selection_process: string;
  source_document_url: string;
}

export interface DraftJdRequest {
  title: string;
  department: string;
  brief: string;
}

export type DisplayJobStatus = "draft" | "open" | "paused" | "closed";

/**
 * A job stays "open" in the database until someone edits it, so an open job
 * whose close date has passed is shown as closed. The public careers page
 * already hides it by the same date.
 */
export function displayJobStatus(
  job: { status: string; closes_at: string | null },
  now: Date = new Date(),
): DisplayJobStatus {
  if (job.status === "open" && job.closes_at && new Date(job.closes_at) <= now)
    return "closed";
  return job.status as DisplayJobStatus;
}
