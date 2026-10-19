"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { hasRole } from "@/lib/rbac";
import type { Candidate, CandidateStage } from "@/types/database";

export type CandidateWithJob = Candidate & {
  jobs: { title: string; department: string | null } | null;
};

export type NoteWithUser = {
  id: string;
  candidate_id: string;
  user_id: string;
  note: string;
  created_at: string;
  users: { name: string } | null;
};

export async function getCandidates(jobId?: string): Promise<CandidateWithJob[]> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthenticated");

  let query = supabaseAdmin
    .from("candidates")
    .select("*, jobs(title, department)")
    .order("applied_at", { ascending: false });

  if (jobId) query = query.eq("job_id", jobId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CandidateWithJob[];
}

export async function getCandidate(id: string): Promise<CandidateWithJob> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthenticated");

  const { data, error } = await supabaseAdmin
    .from("candidates")
    .select("*, jobs(title, department)")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as CandidateWithJob;
}

export async function updateCandidateStage(id: string, stage: CandidateStage) {
  const session = await getServerSession(authOptions);
  if (!session || !hasRole(session.user.role, "hiring_manager")) throw new Error("Forbidden");

  const { error } = await supabaseAdmin
    .from("candidates")
    .update({ stage })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/hire/candidates");
  revalidatePath(`/hire/candidates/${id}`);
  revalidatePath("/hire/pipeline");
}

export async function assignCandidate(id: string, userId: string) {
  const session = await getServerSession(authOptions);
  if (!session || !hasRole(session.user.role, "hr")) throw new Error("Forbidden");

  const { error } = await supabaseAdmin
    .from("candidates")
    .update({ assigned_to: userId })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath(`/hire/candidates/${id}`);
}

export async function addNote(candidateId: string, note: string) {
  const session = await getServerSession(authOptions);
  if (!session || !hasRole(session.user.role, "interviewer")) throw new Error("Forbidden");

  const { error } = await supabaseAdmin.from("candidate_notes").insert({
    candidate_id: candidateId,
    user_id: session.user.id,
    note,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/hire/candidates/${candidateId}`);
}

export async function getCandidateNotes(candidateId: string): Promise<NoteWithUser[]> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthenticated");

  const { data, error } = await supabaseAdmin
    .from("candidate_notes")
    .select("*, users(name)")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as NoteWithUser[];
}

export async function shortlistCandidate(id: string, shortlisted: boolean) {
  const session = await getServerSession(authOptions);
  if (!session || !hasRole(session.user.role, "hr")) throw new Error("Forbidden");

  const { error } = await supabaseAdmin
    .from("candidates")
    .update({ shortlisted })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath(`/hire/candidates/${id}`);
  revalidatePath("/hire/candidates");
}
