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
  rolePipeline: { role: string; applied: number; screened: number; interview: number; offer: number }[];
  stageAging: { stage: string; count: number; averageDays: number }[];
  teamPulseTrend: { week: string; checkins: number; mood: number | null }[];
  recent: RecentCandidate[];
  operations: {
    interviewQueue: RecentCandidate[];
    upcomingOneOnOnes: { id: string; scheduled_at: string; manager: string; report: string }[];
    actionItems: { label: string; count: number; href: string; tone: "amber" | "red" | "blue" }[];
    health: { averageDaysToHire: number | null; stalledCandidates: number; offerPending: number; offerAccepted: number; offerDeclined: number };
    pulse: { pendingCheckins: number; lowMood: number; blockers: number; atRiskGoals: number };
    scheduledJobs: { id: string; title: string; published_at: string | null; closes_at: string | null; kind: "publishes" | "closes" }[];
    goals: { onTrack: number; atRisk: number; completed: number; notStarted: number };
    newHires: { id: string; name: string; job_title: string | null; department: string | null; start_date: string }[];
    activeSurveys: { id: string; title: string; response_count: number }[];
  };
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
  const key = cacheKey("dashboard", "v3", rangeKey(range));
  return cached("dashboard", key, "dynamic", async () => {
    const start = range.startDate.toISOString();
    const end = range.endDate.toISOString();

    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const sixWeeksAgo = new Date(now);
    sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [rangeCandidatesRes, currentJobsRes, currentCandidatesRes, employeesRes, reviewsRes, scorecardsRes, checkinsRes, pulseHistoryRes, goalsRes, conversationsRes, scheduledJobsRes, allGoalsRes, newHiresRes, activeSurveysRes] = await Promise.all([
      supabaseAdmin
        .from("candidates")
        .select("id, applied_at")
        .gte("applied_at", start)
        .lte("applied_at", end),
      supabaseAdmin
        .from("jobs")
        .select("id, status"),
      supabaseAdmin
        .from("candidates")
        .select("id, full_name, stage, applied_at, ai_score, shortlisted, hired_user_id, jobs(title)"),
      supabaseAdmin.from("users").select("id", { count: "exact" }).eq("is_active", true),
      supabaseAdmin
        .from("performance_reviews")
        .select("id", { count: "exact" })
        .gte("created_at", start)
        .lte("created_at", end),
      supabaseAdmin.from("interview_scorecards").select("candidate_id, submitted_at"),
      supabaseAdmin.from("checkins").select("status, mood, blockers").gte("week_start", weekStart.toISOString().slice(0, 10)),
      supabaseAdmin.from("checkins").select("week_start, status, mood").gte("week_start", sixWeeksAgo.toISOString().slice(0, 10)).order("week_start"),
      supabaseAdmin.from("goals").select("id").eq("status", "at_risk"),
      supabaseAdmin.from("one_on_ones").select("id, scheduled_at, manager:users!one_on_ones_manager_id_fkey(name), report:users!one_on_ones_report_id_fkey(name)").gte("scheduled_at", now.toISOString()).order("scheduled_at").limit(5),
      supabaseAdmin.from("jobs").select("id, title, published_at, closes_at").eq("status", "open").or(`published_at.gte.${now.toISOString()},closes_at.gte.${now.toISOString()}`),
      supabaseAdmin.from("goals").select("id, status"),
      supabaseAdmin.from("users").select("id, name, job_title, department, start_date").eq("is_active", true).gte("start_date", thirtyDaysAgo).order("start_date", { ascending: false }).limit(6),
      supabaseAdmin.from("surveys").select("id, title, survey_responses(id)").eq("status", "active").limit(5),
    ]);

    const jobs = currentJobsRes.data ?? [];
    const candidates = (currentCandidatesRes.data ?? []) as unknown as (RecentCandidate & {
      shortlisted?: boolean;
      hired_user_id?: string | null;
    })[];
    const rangeCandidates = rangeCandidatesRes.data ?? [];

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
    for (const c of rangeCandidates) {
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

    // ── Chart series ───────────────────────────────────────────────────────
    // Keep role comparison focused on active stages: hired/rejected are outcomes,
    // not work currently moving through the hiring funnel.
    const roles = new Map<string, { role: string; applied: number; screened: number; interview: number; offer: number }>();
    for (const candidate of candidates) {
      if (!(["applied", "screened", "interview", "offer"] as const).includes(candidate.stage as "applied" | "screened" | "interview" | "offer")) continue;
      const role = candidate.jobs?.title ?? "Unassigned";
      const entry = roles.get(role) ?? { role, applied: 0, screened: 0, interview: 0, offer: 0 };
      entry[candidate.stage as "applied" | "screened" | "interview" | "offer"] += 1;
      roles.set(role, entry);
    }
    const rolePipeline = [...roles.values()]
      .sort((a, b) => (b.applied + b.screened + b.interview + b.offer) - (a.applied + a.screened + a.interview + a.offer))
      .slice(0, 5);

    const stageAging = (["applied", "screened", "interview", "offer"] as const).map((stage) => {
      const inStage = candidates.filter((candidate) => candidate.stage === stage);
      return {
        stage,
        count: inStage.length,
        averageDays: inStage.length
          ? Math.round(inStage.reduce((sum, candidate) => sum + (now.getTime() - new Date(candidate.applied_at).getTime()) / (24 * 60 * 60 * 1000), 0) / inStage.length)
          : 0,
      };
    });

    const weeklyPulse = new Map<string, { checkins: number; moodTotal: number; moodCount: number }>();
    for (const checkin of pulseHistoryRes.data ?? []) {
      const key = checkin.week_start;
      const entry = weeklyPulse.get(key) ?? { checkins: 0, moodTotal: 0, moodCount: 0 };
      if (checkin.status === "submitted" || checkin.status === "reviewed") entry.checkins += 1;
      if (checkin.mood !== null) { entry.moodTotal += checkin.mood; entry.moodCount += 1; }
      weeklyPulse.set(key, entry);
    }
    const teamPulseTrend = [...weeklyPulse.entries()].map(([week, value]) => ({
      week: new Date(`${week}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      checkins: value.checkins,
      mood: value.moodCount ? Number((value.moodTotal / value.moodCount).toFixed(1)) : null,
    }));

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

    const submittedScorecards = new Set(
      (scorecardsRes.data ?? []).filter((scorecard) => scorecard.submitted_at).map((scorecard) => scorecard.candidate_id)
    );
    const interviewQueue = candidates
      .filter((candidate) => candidate.stage === "interview" && !submittedScorecards.has(candidate.id))
      .sort((a, b) => new Date(a.applied_at).getTime() - new Date(b.applied_at).getTime())
      .slice(0, 5)
      .map((candidate) => ({ id: candidate.id, full_name: candidate.full_name, stage: candidate.stage, applied_at: candidate.applied_at, ai_score: candidate.ai_score, jobs: candidate.jobs }));
    const hiredCandidates = candidates.filter((candidate) => candidate.stage === "hired");
    const averageDaysToHire = hiredCandidates.length
      ? Math.round(hiredCandidates.reduce((sum, candidate) => sum + (now.getTime() - new Date(candidate.applied_at).getTime()) / (24 * 60 * 60 * 1000), 0) / hiredCandidates.length)
      : null;
    const stalledCandidates = candidates.filter((candidate) =>
      !["hired", "rejected"].includes(candidate.stage) && candidate.applied_at < fourteenDaysAgo
    ).length;
    const hiresAwaitingStaffRecord = candidates.filter((candidate) => candidate.stage === "hired" && !candidate.hired_user_id).length;
    const checkins = checkinsRes.data ?? [];
    const submittedCheckins = checkins.filter((checkin) => checkin.status === "submitted" || checkin.status === "reviewed").length;
    const scheduledJobs = (scheduledJobsRes.data ?? []).flatMap((job) => [
      ...(job.published_at && new Date(job.published_at) >= now ? [{ id: job.id, title: job.title, published_at: job.published_at, closes_at: job.closes_at, kind: "publishes" as const }] : []),
      ...(job.closes_at && new Date(job.closes_at) >= now ? [{ id: job.id, title: job.title, published_at: job.published_at, closes_at: job.closes_at, kind: "closes" as const }] : []),
    ]).sort((a, b) => new Date(a.kind === "publishes" ? a.published_at! : a.closes_at!).getTime() - new Date(b.kind === "publishes" ? b.published_at! : b.closes_at!).getTime()).slice(0, 5);
    const allGoals = allGoalsRes.data ?? [];
    const goalsBreakdown = {
      onTrack: allGoals.filter((g) => g.status === "in_progress").length,
      atRisk: allGoals.filter((g) => g.status === "at_risk").length,
      completed: allGoals.filter((g) => g.status === "completed").length,
      notStarted: allGoals.filter((g) => g.status === "not_started").length,
    };

    const newHires = (newHiresRes.data ?? []).map((u) => ({
      id: u.id,
      name: u.name,
      job_title: u.job_title,
      department: u.department,
      start_date: u.start_date!,
    }));

    const activeSurveys = (activeSurveysRes.data ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      response_count: Array.isArray(s.survey_responses) ? s.survey_responses.length : 0,
    }));

    const upcomingOneOnOnes = (conversationsRes.data ?? []).map((meeting) => ({
      id: meeting.id,
      scheduled_at: meeting.scheduled_at!,
      manager: (meeting.manager as unknown as { name: string } | null)?.name ?? "Manager",
      report: (meeting.report as unknown as { name: string } | null)?.name ?? "Team member",
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
      rolePipeline,
      stageAging,
      teamPulseTrend,
      recent,
      operations: {
        interviewQueue,
        upcomingOneOnOnes,
        actionItems: [
          { label: "Awaiting AI screen", count: pendingScreen, href: "/hire/candidates", tone: "amber" },
          { label: "Interview scorecards due", count: interviewQueue.length, href: "/hire/candidates?stage=interview", tone: "blue" },
          { label: "New hires to add to staff", count: hiresAwaitingStaffRecord, href: "/hire/candidates?stage=hired", tone: "amber" },
          { label: "Stalled candidates", count: stalledCandidates, href: "/hire/candidates", tone: "red" },
        ].filter((item) => item.count > 0) as DashboardData["operations"]["actionItems"],
        health: { averageDaysToHire, stalledCandidates, offerPending: stageCounts.get("offer") ?? 0, offerAccepted: hired, offerDeclined: stageCounts.get("rejected") ?? 0 },
        pulse: { pendingCheckins: Math.max((employeesRes.count ?? 0) - submittedCheckins, 0), lowMood: checkins.filter((checkin) => (checkin.mood ?? 5) <= 2).length, blockers: checkins.filter((checkin) => !!checkin.blockers?.trim()).length, atRiskGoals: goalsRes.data?.length ?? 0 },
        scheduledJobs,
        goals: goalsBreakdown,
        newHires,
        activeSurveys,
      },
    };
  });
}
