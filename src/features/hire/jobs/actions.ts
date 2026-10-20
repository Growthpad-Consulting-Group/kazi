"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { hasRole } from "@/lib/rbac";
import { invalidateTables } from "@/lib/cache/invalidate";
import { getCachedJob, getCachedJobs } from "@/lib/cache/queries";
import type { Database } from "@/types/database";
import type { JobFormData } from "./types";

function scheduledDate(value: string | null | undefined, label: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid date and time`);
  return date.toISOString();
}

function validateSchedule(form: Pick<JobFormData, "published_at" | "closes_at">) {
  const publishedAt = scheduledDate(form.published_at, "Publish date");
  const closesAt = scheduledDate(form.closes_at, "Close date");
  if (publishedAt && closesAt && new Date(closesAt) <= new Date(publishedAt)) {
    throw new Error("Close date must be after the publish date");
  }
  return { publishedAt, closesAt };
}

export async function getJobs() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthenticated");

  return getCachedJobs();
}

export async function getJob(id: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthenticated");

  return getCachedJob(id);
}

export async function createJob(form: JobFormData) {
  const session = await getServerSession(authOptions);
  if (!session || !hasRole(session.user.role, "hr")) throw new Error("Forbidden");

  const { publishedAt, closesAt } = validateSchedule(form);

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
      // Opening a job with no schedule publishes it immediately.
      published_at: publishedAt ?? (form.status === "open" ? new Date().toISOString() : null),
      closes_at: closesAt,
      created_by: session.user.id,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/hire/jobs");
  await invalidateTables("jobs");
  return data;
}

export async function updateJob(id: string, form: Partial<JobFormData>) {
  const session = await getServerSession(authOptions);
  if (!session || !hasRole(session.user.role, "hr")) throw new Error("Forbidden");

  type JobUpdate = Database["public"]["Tables"]["jobs"]["Update"];
  const update: JobUpdate = {};
  if (form.published_at !== undefined || form.closes_at !== undefined) {
    const { publishedAt, closesAt } = validateSchedule({
      published_at: form.published_at ?? null,
      closes_at: form.closes_at ?? null,
    });
    if (form.published_at !== undefined) update.published_at = publishedAt;
    if (form.closes_at !== undefined) update.closes_at = closesAt;
  }
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
  if (form.status !== undefined) {
    update.status = form.status;
    if (form.status === "open" && form.published_at === undefined) {
      const { data: current, error: currentError } = await supabaseAdmin
        .from("jobs")
        .select("published_at")
        .eq("id", id)
        .single();
      if (currentError) throw new Error(currentError.message);
      if (!current?.published_at) update.published_at = new Date().toISOString();
    }
  }

  const { data, error } = await supabaseAdmin
    .from("jobs")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/hire/jobs");
  revalidatePath(`/hire/jobs/${id}`);
  await invalidateTables("jobs");
  return data;
}

export async function deleteJob(id: string) {
  const session = await getServerSession(authOptions);
  if (!session || !hasRole(session.user.role, "admin")) throw new Error("Forbidden");

  const { error } = await supabaseAdmin.from("jobs").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/hire/jobs");
  await invalidateTables("jobs");
}
