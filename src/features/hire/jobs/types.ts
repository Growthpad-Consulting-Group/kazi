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
  status: "draft" | "open";
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
