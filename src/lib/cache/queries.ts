/**
 * Domain Cache Queries
 *
 * Read-through cache wrappers around the hot Supabase queries. Each function
 * owns its cache key, TTL strategy and invalidation group, so call sites stay
 * simple: `getCachedJobs()` instead of a hand-rolled fetch + cache + key.
 *
 * Scoping rules:
 *  - Organisation-wide data (jobs, candidates, departments, dashboard) is
 *    shared by every user and cached under a group key.
 *  - Per-user data (my check-ins, private feedback, notifications) is keyed by
 *    user id so one user can never read another's cached response.
 */

import { supabaseAdmin } from "@/lib/supabase";
import { cached } from "./core";
import {
  cacheKey,
  checkinsCacheKey,
  filterSuffix,
  goalsCacheKey,
  notificationsCacheKey,
  oneOnOnesCacheKey,
  privateFeedbackCacheKey,
  publicFeedbackCacheKey,
} from "./groups";
import type { CacheGroup } from "./groups";
import type {
  Job,
  Candidate,
  Checkin,
  Feedback,
  Goal,
  OneOnOne,
} from "@/types/database";

/* ── Reference data ───────────────────────────────────────────────────────── */

/** All department names, ordered. Reference data — changes rarely. */
export async function getCachedDepartments(): Promise<string[]> {
  return cached(
    "reference",
    cacheKey("reference", "departments"),
    "stable",
    async () => {
      const { data, error } = await supabaseAdmin
        .from("departments")
        .select("name")
        .order("name", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((d) => d.name as string);
    },
  );
}

/* ── People ──────────────────────────────────────────────────────────────── */

export interface CachedUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  job_title: string | null;
  location: string | null;
  manager_id: string | null;
  avatar_url: string | null;
}

/** The employee directory. Read by the People page and by dashboard counts. */
export async function getCachedStaff(): Promise<CachedUserRow[]> {
  return cached("staff", cacheKey("staff", "list"), "dynamic", async () => {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select(
        "id, name, email, role, department, job_title, location, manager_id, avatar_url",
      )
      .eq("is_active", true)
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as CachedUserRow[];
  });
}

/* ── Jobs ────────────────────────────────────────────────────────────────── */

/** All job postings, newest first. */
/** Applicant totals per job. Only the two columns the jobs table needs are read. */
export async function getCachedApplicantCounts(): Promise<
  Record<string, { applicants: number; shortlisted: number }>
> {
  return cached(
    "candidates",
    cacheKey("candidates", "applicant-counts"),
    "dynamic",
    async () => {
      const { data, error } = await supabaseAdmin
        .from("candidates")
        .select("job_id, shortlisted");
      if (error) throw new Error(error.message);
      const counts: Record<
        string,
        { applicants: number; shortlisted: number }
      > = {};
      for (const row of (data ?? []) as Array<{
        job_id: string;
        shortlisted: boolean;
      }>) {
        const entry = (counts[row.job_id] ??= {
          applicants: 0,
          shortlisted: 0,
        });
        entry.applicants += 1;
        if (row.shortlisted) entry.shortlisted += 1;
      }
      return counts;
    },
  );
}

export async function getCachedJobs(): Promise<Job[]> {
  return cached("jobs", cacheKey("jobs", "list"), "dynamic", async () => {
    const { data, error } = await supabaseAdmin
      .from("jobs")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as Job[];
  });
}

/** A single job posting. */
export async function getCachedJob(id: string): Promise<Job | null> {
  return cached("jobs", cacheKey("jobs", "detail", id), "dynamic", async () => {
    const { data, error } = await supabaseAdmin
      .from("jobs")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw new Error(error.message);
    return data as unknown as Job | null;
  });
}

/* ── Candidates ──────────────────────────────────────────────────────────── */

export interface CachedCandidate extends Omit<Candidate, "cv_text"> {
  // The list and pipeline never render raw CV text. Keep the shape explicit so
  // callers cannot accidentally reintroduce that large, sensitive payload.
  cv_text: null;
  jobs: { title: string; department: string | null } | null;
}

/**
 * Candidates with their job attached.
 *
 * @param jobId Optional job filter.
 * @param activeOnly When true, excludes rejected candidates (pipeline board).
 */
export async function getCachedCandidates(
  jobId?: string,
  activeOnly = false,
): Promise<CachedCandidate[]> {
  const key = cacheKey(
    "candidates",
    "list",
    filterSuffix({ job: jobId, active: activeOnly ? "1" : undefined }),
  );
  return cached("candidates", key, "dynamic", async () => {
    let query = supabaseAdmin
      .from("candidates")
      .select(
        "id, job_id, full_name, email, phone, location, linkedin_url, portfolio_url, cover_message, cv_url, cv_parsed, stage, assigned_to, source, ai_score, ai_justification, shortlisted, consented_at, hired_user_id, applied_at, created_at, updated_at, jobs(title, department)",
      )
      // Highest AI fit first; candidates awaiting analysis remain after scored candidates.
      .order("ai_score", { ascending: false, nullsFirst: false })
      .order("applied_at", { ascending: false });
    if (jobId) query = query.eq("job_id", jobId);
    if (activeOnly)
      query = query.in("stage", [
        "applied",
        "screened",
        "interview",
        "offer",
        "hired",
      ]);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as CachedCandidate[];
  });
}

/* ── Notifications (per user) ────────────────────────────────────────────── */

export interface CachedNotification {
  id: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

/**
 * Notifications for a single user.
 *
 * Scoped by user id — the key is unique per recipient, so one user's
 * notifications can never be served to another.
 */
export async function getCachedNotifications(
  userId: string,
): Promise<CachedNotification[]> {
  return cached(
    "notifications",
    notificationsCacheKey(userId),
    "realtime",
    async () => {
      const { data, error } = await supabaseAdmin
        .from("notifications")
        .select("id, message, link, read, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as CachedNotification[];
    },
  );
}

/* ── Pulse (per user where applicable) ───────────────────────────────────── */

/** A user's own check-ins. Scoped by user id. */
export async function getCachedMyCheckins(userId: string): Promise<Checkin[]> {
  return cached("pulse", checkinsCacheKey(userId), "realtime", async () => {
    const { data, error } = await supabaseAdmin
      .from("checkins")
      .select("*")
      .eq("user_id", userId)
      .order("week_start", { ascending: false })
      .limit(12);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as Checkin[];
  });
}

export type FeedbackWithUsers = Feedback & {
  from: { name: string } | null;
  to: { name: string } | null;
};

/** A user's own private feedback. Scoped by user id. */
export async function getCachedPrivateFeedback(
  userId: string,
): Promise<FeedbackWithUsers[]> {
  return cached(
    "pulse",
    privateFeedbackCacheKey(userId),
    "realtime",
    async () => {
      const { data, error } = await supabaseAdmin
        .from("feedback")
        .select("*, from:from_user_id(name), to:to_user_id(name)")
        .eq("to_user_id", userId)
        .eq("visibility", "private")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as FeedbackWithUsers[];
    },
  );
}

/** Public feedback wall. Organisation-wide. */
export async function getCachedPublicFeedback(
  limit = 20,
): Promise<FeedbackWithUsers[]> {
  return cached("pulse", publicFeedbackCacheKey(limit), "dynamic", async () => {
    const { data, error } = await supabaseAdmin
      .from("feedback")
      .select("*, from:from_user_id(name), to:to_user_id(name)")
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as FeedbackWithUsers[];
  });
}

/** Goals, optionally filtered by owner and level. */
export async function getCachedGoals(filters?: {
  ownerId?: string;
  level?: string;
}): Promise<Goal[]> {
  const key = goalsCacheKey(filters);
  return cached("pulse", key, "dynamic", async () => {
    let q = supabaseAdmin.from("goals").select("*").order("created_at");
    if (filters?.ownerId) q = q.eq("owner_id", filters.ownerId);
    if (filters?.level) q = q.eq("level", filters.level as never);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as Goal[];
  });
}

/** One-on-ones visible to a manager or report. Scoped by the querying user. */
export async function getCachedOneOnOnes(params: {
  managerId?: string;
  reportId?: string;
}): Promise<OneOnOne[]> {
  const key = oneOnOnesCacheKey(params);
  return cached("pulse", key, "dynamic", async () => {
    let q = supabaseAdmin
      .from("one_on_ones")
      .select("*")
      .order("scheduled_at", { ascending: false });
    if (params.managerId) q = q.eq("manager_id", params.managerId);
    if (params.reportId) q = q.eq("report_id", params.reportId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as OneOnOne[];
  });
}

export type { CacheGroup };
