/**
 * Dashboard data.
 *
 * The dashboard used to issue ~13 separate Supabase queries per render:
 * six counts, six per-stage counts, a trend scan and a recent-candidates
 * list. Since every one of those numbers is derived from the same two
 * tables, we now fetch the rows once and aggregate in memory — four
 * queries instead of thirteen — and cache the result per date range.
 */

import { supabaseAdmin } from "@/lib/supabase";
import { cached } from "@/lib/cache/core";
import { cacheKey } from "@/lib/cache/groups";

export interface DashboardRange {
  startDate: Date;
  endDate: Date;
}

export interface DashboardStats {
  openJobs: number;
  activePipeline: number;
  pendingScreen: number;
  activeEmployees: number;
  totalReviews: number;
  hired: number;
}

export type PipelineStage = {
  stage: string;
  count: number;
};

export type RecentCandidate = {
  id: string;
  full_name: string;
  stage: string;
  applied_at: string;
  ai_score: number | null;
  jobs: { title: string } | null;
};

export interface DashboardData {
  stats: DashboardStats;
  pipeline: PipelineStage[];
  trend: { day: string; count: number }[];
  recent: RecentCandidate[];
}

const STAGES = ["applied", "screened", "interview", "offer", "hired", "rejected"] as const;

/** A stable, sortable identifier for a range, so the cache key matches. */
function rangeKey(range: DashboardRange): string {
  return `${range.startDate.toISOString()}_${range.endDate.toISOString()}`;
}

/**
 * Load everything the dashboard renders, cached for the given range.
 */
export async function getDashboardData(range: DashboardRange): Promise<DashboardData> {
  const key = cacheKey("dashboard", "v2", rangeKey(range));
  return cached("dashboard", key, "dynamic", async () => {
    const start = range.startDate.toISOString();
    const end = range.endDate.toISOString();

    const [jobsRes, candidatesRes, employeesRes, reviewsRes] = await Promise.all([
      supabaseAdmin
        .from("jobs")
        .select("id, status, created_at")
        .gte("created_at", start)
        .lte("created_at", end),
      supabaseAdmin
        .from("candidates")
        .select("id, full_name, stage, applied_at, ai_score, shortlisted, jobs(title)")
        .gte("applied_at", start)
        .lte("applied_at", end),
      supabaseAdmin.from("users").select("id", { count: "exact" }).eq("is_active", true),
      supabaseAdmin
        .from("performance_reviews")
        .select("id", { count: "exact" })
        .gte("created_at", start)
        .lte("created_at", end),
    ]);

    const jobs = jobsRes.data ?? [];
    const candidates = (candidatesRes.data ?? []) as unknown as (RecentCandidate & {
      shortlisted?: boolean;
    })[];

    // Aggregate every candidate-derived metric from the single fetch above.
    const stageCounts = new Map<string, number>();
    let activePipeline = 0;
    let pendingScreen = 0;
    let hired = 0;

    for (const c of candidates) {
      stageCounts.set(c.stage, (stageCounts.get(c.stage) ?? 0) + 1);
      if (c.stage !== "hired" && c.stage !== "rejected") activePipeline += 1;
      if (c.stage === "applied" && c.ai_score === null) pendingScreen += 1;
      if (c.stage === "hired") hired += 1;
    }

    const pipeline: PipelineStage[] = STAGES.map((stage) => ({
      stage,
      count: stageCounts.get(stage) ?? 0,
    }));

    const openJobs = jobs.filter((j) => j.status === "open").length;

    // ── Applications trend ────────────────────────────────────────────────
    const DAY = 24 * 60 * 60 * 1000;
    const totalDays = Math.min(
      Math.max(Math.ceil((range.endDate.getTime() - range.startDate.getTime()) / DAY), 1),
      90
    );
    const counts = new Map<string, number>();
    for (const c of candidates) {
      const d = new Date(c.applied_at).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
      });
      counts.set(d, (counts.get(d) ?? 0) + 1);
    }
    const trend: { day: string; count: number }[] = [];
    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(range.endDate);
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
      trend.push({ day: label, count: counts.get(label) ?? 0 });
    }

    // ── Recent candidates ─────────────────────────────────────────────────
    const recent = [...candidates]
      .sort((a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime())
      .slice(0, 8)
      .map((c) => ({
        id: c.id,
        full_name: c.full_name,
        stage: c.stage,
        applied_at: c.applied_at,
        ai_score: c.ai_score,
        jobs: c.jobs,
      }));

    return {
      stats: {
        openJobs,
        activePipeline,
        pendingScreen,
        activeEmployees: employeesRes.count ?? 0,
        totalReviews: reviewsRes.count ?? 0,
        hired,
      },
      pipeline,
      trend,
      recent,
    };
  });
}
