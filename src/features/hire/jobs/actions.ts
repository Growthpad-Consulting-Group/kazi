"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { hasRole } from "@/lib/rbac";
import type { Database } from "@/types/database";
import type { JobFormData } from "./types";

export async function getJobs() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthenticated");

  const { data, error } = await supabaseAdmin
    .from("jobs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function getJob(id: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthenticated");

  const { data, error } = await supabaseAdmin
    .from("jobs")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function createJob(form: JobFormData) {
  const session = await getServerSession(authOptions);
  if (!session || !hasRole(session.user.role, "hr")) throw new Error("Forbidden");

  const { data, error } = await supabaseAdmin
    .from("jobs")
    .insert({
      title: form.title,
      department: form.department || null,
      location: form.location || null,
      description: form.description || null,
      requirements: { must_haves: form.must_haves, nice_to_haves: form.nice_to_haves },
      scoring_rubric: form.scoring_rubric,
      status: form.status,
      created_by: session.user.id,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/hire/jobs");
  return data;
}

export async function updateJob(id: string, form: Partial<JobFormData>) {
  const session = await getServerSession(authOptions);
  if (!session || !hasRole(session.user.role, "hr")) throw new Error("Forbidden");

  type JobUpdate = Database["public"]["Tables"]["jobs"]["Update"];
  const update: JobUpdate = {};
  if (form.title !== undefined) update.title = form.title;
  if (form.department !== undefined) update.department = form.department || null;
  if (form.location !== undefined) update.location = form.location || null;
  if (form.description !== undefined) update.description = form.description || null;
  if (form.must_haves !== undefined || form.nice_to_haves !== undefined) {
    update.requirements = {
      must_haves: form.must_haves ?? [],
      nice_to_haves: form.nice_to_haves ?? [],
    };
  }
  if (form.scoring_rubric !== undefined) update.scoring_rubric = form.scoring_rubric;
  if (form.status !== undefined) update.status = form.status;

  const { data, error } = await supabaseAdmin
    .from("jobs")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/hire/jobs");
  revalidatePath(`/hire/jobs/${id}`);
  return data;
}

export async function deleteJob(id: string) {
  const session = await getServerSession(authOptions);
  if (!session || !hasRole(session.user.role, "admin")) throw new Error("Forbidden");

  const { error } = await supabaseAdmin.from("jobs").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/hire/jobs");
}
