"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { notifyCareersSiteJobsChanged } from "@/lib/careers-site";
import { notifyGoogleOfJob } from "@/lib/google-job-indexing";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { can } from "@/lib/rbac";
import { invalidateTables } from "@/lib/cache/invalidate";
import { canonicalDepartment } from "@/lib/departments";
import {
  getCachedApplicantCounts,
  getCachedJob,
  getCachedJobs,
} from "@/lib/cache/queries";
import type { Database } from "@/types/database";
import type { JobFormData } from "./types";

function jobSlug(title: string) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

function scheduledDate(value: string | null | undefined, label: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new Error(`${label} must be a valid date and time`);
  return date.toISOString();
}

function validateSchedule(
  form: Pick<JobFormData, "published_at" | "closes_at">,
) {
  const publishedAt = scheduledDate(form.published_at, "Publish date");
  const closesAt = scheduledDate(form.closes_at, "Close date");
  if (publishedAt && closesAt && new Date(closesAt) <= new Date(publishedAt)) {
    throw new Error("Close date must be after the publish date");
  }
  return { publishedAt, closesAt };
}

type IndexableJob = {
  id: string;
  slug: string;
  status: Database["public"]["Tables"]["jobs"]["Row"]["status"];
  published_at: string | null;
  closes_at: string | null;
};

function isPublicJob(job: Omit<IndexableJob, "id">) {
  const now = new Date();
  return (
    job.status === "open" &&
    (!job.published_at || new Date(job.published_at) <= now) &&
    (!job.closes_at || new Date(job.closes_at) > now)
  );
}

async function syncGoogleJobIndexing(
  job: IndexableJob,
  previous?: Omit<IndexableJob, "id"> | null,
) {
  const type = isPublicJob(job)
    ? "URL_UPDATED"
    : previous && isPublicJob(previous)
      ? "URL_DELETED"
      : null;
  if (!type || !(await notifyGoogleOfJob(job.slug, type))) return;

  await supabaseAdmin
    .from("jobs")
    .update(
      type === "URL_UPDATED"
        ? {
            google_indexed_at: new Date().toISOString(),
            google_removed_at: null,
          }
        : { google_removed_at: new Date().toISOString() },
    )
    .eq("id", job.id);
}

export async function getJobs() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthenticated");

  return getCachedJobs();
}

export async function getJobApplicantCounts() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthenticated");

  return getCachedApplicantCounts();
}

export async function getJob(id: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthenticated");

  return getCachedJob(id);
}

export async function createJob(form: JobFormData) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_hiring"))
    throw new Error("Forbidden");

  const { publishedAt, closesAt } = validateSchedule(form);
  const department = await canonicalDepartment(form.department);

  const { data, error } = await supabaseAdmin
    .from("jobs")
    .insert({
      slug: jobSlug(form.title),
      title: form.title,
      department,
      location: form.location || null,
      description: form.description || null,
      requirements: {
        must_haves: form.must_haves,
        nice_to_haves: form.nice_to_haves,
      },
      scoring_rubric: form.scoring_rubric,
      status: form.status,
      // Opening a job with no schedule publishes it immediately.
      published_at:
        publishedAt ??
        (form.status === "open" ? new Date().toISOString() : null),
      closes_at: closesAt,
      employment_type: form.employment_type || null,
      work_mode: form.work_mode || null,
      contract_duration: form.contract_duration || null,
      compensation: form.compensation || null,
      reports_to: form.reports_to || null,
      benefits: form.benefits || null,
      application_instructions: form.application_instructions || null,
      selection_process: form.selection_process || null,
      source_document_url: form.source_document_url || null,
      created_by: session.user.id,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/hire/jobs");
  await invalidateTables("jobs");
  await notifyCareersSiteJobsChanged();
  await syncGoogleJobIndexing(data);
  return data;
}

export async function updateJob(id: string, form: Partial<JobFormData>) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_hiring"))
    throw new Error("Forbidden");

  const { data: previous, error: previousError } = await supabaseAdmin
    .from("jobs")
    .select("slug, status, published_at, closes_at")
    .eq("id", id)
    .single();
  if (previousError) throw new Error(previousError.message);

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
  if (form.department !== undefined)
    update.department = await canonicalDepartment(form.department);
  if (form.location !== undefined) update.location = form.location || null;
  if (form.description !== undefined)
    update.description = form.description || null;
  if (form.employment_type !== undefined)
    update.employment_type = form.employment_type || null;
  if (form.work_mode !== undefined) update.work_mode = form.work_mode || null;
  if (form.contract_duration !== undefined)
    update.contract_duration = form.contract_duration || null;
  if (form.compensation !== undefined)
    update.compensation = form.compensation || null;
  if (form.reports_to !== undefined)
    update.reports_to = form.reports_to || null;
  if (form.benefits !== undefined) update.benefits = form.benefits || null;
  if (form.application_instructions !== undefined)
    update.application_instructions = form.application_instructions || null;
  if (form.selection_process !== undefined)
    update.selection_process = form.selection_process || null;
  if (form.source_document_url !== undefined)
    update.source_document_url = form.source_document_url || null;
  if (form.must_haves !== undefined || form.nice_to_haves !== undefined) {
    update.requirements = {
      must_haves: form.must_haves ?? [],
      nice_to_haves: form.nice_to_haves ?? [],
    };
  }
  if (form.scoring_rubric !== undefined)
    update.scoring_rubric = form.scoring_rubric;
  if (form.status !== undefined) {
    update.status = form.status;
    if (form.status === "open" && form.published_at === undefined) {
      if (!previous?.published_at)
        update.published_at = new Date().toISOString();
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
  await notifyCareersSiteJobsChanged();
  await syncGoogleJobIndexing(data, previous);
  return data;
}

export async function deleteJob(id: string) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_system"))
    throw new Error("Forbidden");

  const { data: previous, error: previousError } = await supabaseAdmin
    .from("jobs")
    .select("id, slug, status, published_at, closes_at")
    .eq("id", id)
    .maybeSingle();
  if (previousError) throw new Error(previousError.message);

  const { error } = await supabaseAdmin.from("jobs").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/hire/jobs");
  await invalidateTables("jobs");
  await notifyCareersSiteJobsChanged();
  if (previous && isPublicJob(previous))
    await notifyGoogleOfJob(previous.slug, "URL_DELETED");
}
