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
}

export interface DraftJdRequest {
  title: string;
  department: string;
  brief: string;
}
