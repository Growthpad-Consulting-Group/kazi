import type { Candidate, CandidateStage } from "@/types/database";

export type { Candidate, CandidateStage };

export interface CandidateWithJob extends Candidate {
  jobs: { title: string; department: string | null } | null;
}

export interface ApplyFormData {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  source: string;
  cv_file: File;
  consented: boolean;
}

export interface ScreeningResult {
  score: number;
  justification: string;
  shortlisted: boolean;
}

export const STAGE_LABELS: Record<CandidateStage, string> = {
  applied: "Applied",
  screened: "Screened",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Rejected",
};

export const STAGE_COLORS: Record<CandidateStage, string> = {
  applied: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  screened: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
  interview: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  offer: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  hired: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  rejected: "bg-red-500/10 text-red-600 dark:text-red-300",
};
