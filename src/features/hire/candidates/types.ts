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
  applied: "bg-slate-100 text-slate-600",
  screened: "bg-blue-100 text-blue-700",
  interview: "bg-violet-100 text-violet-700",
  offer: "bg-amber-100 text-amber-700",
  hired: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
};
