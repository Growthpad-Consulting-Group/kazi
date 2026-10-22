"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { can } from "@/lib/rbac";
import { invalidateTables } from "@/lib/cache/invalidate";
import { getCachedCandidates } from "@/lib/cache/queries";
import type { Candidate, CandidateStage } from "@/types/database";

export type CandidateWithJob = Candidate & {
  jobs: { title: string; department: string | null; location: string | null } | null;
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

  return (await getCachedCandidates(jobId)) as unknown as CandidateWithJob[];
}

export async function getCandidate(id: string): Promise<CandidateWithJob> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthenticated");

  const { data, error } = await supabaseAdmin
    .from("candidates")
    .select("*, jobs(title, department, location)")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as CandidateWithJob;
}

export async function updateCandidateStage(id: string, stage: CandidateStage) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "view_hiring")) throw new Error("Forbidden");

  const { error } = await supabaseAdmin
    .from("candidates")
    .update({ stage })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/hire/candidates");
  revalidatePath(`/hire/candidates/${id}`);
  revalidatePath("/hire/pipeline");
  await invalidateTables("candidates");
}

export async function assignCandidate(id: string, userId: string) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_hiring")) throw new Error("Forbidden");

  const { error } = await supabaseAdmin
    .from("candidates")
    .update({ assigned_to: userId })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath(`/hire/candidates/${id}`);
  await invalidateTables("candidates");
}

export async function addNote(candidateId: string, note: string) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "conduct_interviews")) throw new Error("Forbidden");

  const { error } = await supabaseAdmin.from("candidate_notes").insert({
    candidate_id: candidateId,
    user_id: session.user.id,
    note,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/hire/candidates/${candidateId}`);
  await invalidateTables("candidate_notes");
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
  if (!session || !can(session.user.role, "manage_hiring")) throw new Error("Forbidden");

  const { error } = await supabaseAdmin
    .from("candidates")
    .update({ shortlisted })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath(`/hire/candidates/${id}`);
  revalidatePath("/hire/candidates");
  await invalidateTables("candidates");
}
