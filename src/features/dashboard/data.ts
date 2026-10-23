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
import { can } from "@/lib/rbac";
import type { UserRole } from "@/types/database";

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

export interface PersonalDashboardData {
  recognitionsGiven: number;
  recognitionsReceived: number;
  goals: { onTrack: number; atRisk: number; completed: number; notStarted: number; total: number };
  upcomingOneOnOnes: { id: string; scheduled_at: string; with: string }[];
  pendingCheckin: boolean;
}

export interface DashboardData {
  view: "org" | "team" | "personal";
  stats: DashboardStats;
  pipeline: PipelineStage[];
  trend: { day: string; count: number }[];
  rolePipeline: { role: string; applied: number; screened: number; interview: number; offer: number }[];
  stageAging: { stage: string; count: number; averageDays: number }[];
  teamPulseTrend: { week: string; checkins: number; mood: number | null }[];
  recent: RecentCandidate[];
  personal?: PersonalDashboardData;
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

export interface DashboardContext {
  userId: string;
  role: UserRole;
  department: string | null;
}

const STAGES = ["applied", "screened", "interview", "offer", "hired", "rejected"] as const;

/** A stable, sortable identifier for a range, so the cache key matches. */
function rangeKey(range: DashboardRange): string {
  return `${range.startDate.toISOString()}_${range.endDate.toISOString()}`;
}

const EMPTY_STATS: DashboardStats = {
  openJobs: 0,
  activePipeline: 0,
  pendingScreen: 0,
  activeEmployees: 0,
  totalReviews: 0,
  hired: 0,
};

const EMPTY_PIPELINE: PipelineStage[] = STAGES.map((stage) => ({ stage, count: 0 }));

const EMPTY_OPERATIONS: DashboardData["operations"] = {
  interviewQueue: [],
  upcomingOneOnOnes: [],
  actionItems: [],
  health: { averageDaysToHire: null, stalledCandidates: 0, offerPending: 0, offerAccepted: 0, offerDeclined: 0 },
  pulse: { pendingCheckins: 0, lowMood: 0, blockers: 0, atRiskGoals: 0 },
  scheduledJobs: [],
  goals: { onTrack: 0, atRisk: 0, completed: 0, notStarted: 0 },
  newHires: [],
  activeSurveys: [],
};

/**
 * Load everything the dashboard renders, cached for the given range and user context.
 */
export async function getDashboardData(
  range: DashboardRange,
  ctx?: DashboardContext
): Promise<DashboardData> {
  // Determine view tier
  const role = ctx?.role;
  const view: "org" | "team" | "personal" = !role
    ? "org"
    : can(role, "manage_system")
    ? "org"
    : can(role, "manage_one_on_ones")
    ? "team"
    : "personal";

  const cacheUserSuffix = ctx ? `${view}_${ctx.userId}` : "org_anon";
  const key = cacheKey("dashboard", "v4", rangeKey(range), cacheUserSuffix);

  return cached("dashboard", key, "dynamic", async () => {
    if (view === "personal" && ctx) {
      return buildPersonalData(range, ctx);
    }
    return buildOrgOrTeamData(range, view === "personal" ? "org" : view, ctx);
  });
}

// ── Personal view ─────────────────────────────────────────────────────────────

async function buildPersonalData(range: DashboardRange, ctx: DashboardContext): Promise<DashboardData> {
  const now = new Date();
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  const [givenRes, receivedRes, goalsRes, oneOnOnesRes, checkinRes, employeesRes] = await Promise.all([
    supabaseAdmin
      .from("feedback")
      .select("id", { count: "exact", head: true })
      .eq("from_user_id", ctx.userId),
    supabaseAdmin
      .from("feedback_recipients")
      .select("feedback_id", { count: "exact", head: true })
      .eq("user_id", ctx.userId),
    supabaseAdmin
      .from("goals")
      .select("id, status")
      .eq("owner_id", ctx.userId),
    supabaseAdmin
      .from("one_on_ones")
      .select("id, scheduled_at, manager:users!one_on_ones_manager_id_fkey(name), report:users!one_on_ones_report_id_fkey(name)")
      .eq("report_id", ctx.userId)
      .gte("scheduled_at", now.toISOString())
      .order("scheduled_at")
      .limit(5),
    supabaseAdmin
      .from("checkins")
      .select("id, status")
      .eq("user_id", ctx.userId)
      .eq("week_start", weekStartStr)
      .maybeSingle(),
    supabaseAdmin.from("users").select("id", { count: "exact" }).eq("is_active", true),
  ]);

  const goals = goalsRes.data ?? [];
  const goalsBreakdown = {
    onTrack: goals.filter((g) => g.status === "in_progress").length,
    atRisk: goals.filter((g) => g.status === "at_risk").length,
    completed: goals.filter((g) => g.status === "completed").length,
    notStarted: goals.filter((g) => g.status === "not_started").length,
    total: goals.length,
  };

  const upcomingOneOnOnes = (oneOnOnesRes.data ?? []).map((m) => ({
    id: m.id,
    scheduled_at: m.scheduled_at!,
    with: (m.manager as unknown as { name: string } | null)?.name ?? "Manager",
  }));

  const pendingCheckin = !checkinRes.data ||
    (checkinRes.data.status !== "submitted" && checkinRes.data.status !== "reviewed");

  const personal: PersonalDashboardData = {
    recognitionsGiven: givenRes.count ?? 0,
    recognitionsReceived: receivedRes.count ?? 0,
    goals: goalsBreakdown,
    upcomingOneOnOnes,
    pendingCheckin,
  };

  const actionItems: DashboardData["operations"]["actionItems"] = [];
  if (pendingCheckin) {
    actionItems.push({ label: "Weekly check-in pending", count: 1, href: "/pulse/checkins", tone: "amber" });
  }
  if (goalsBreakdown.atRisk > 0) {
    actionItems.push({ label: "Goals at risk", count: goalsBreakdown.atRisk, href: "/pulse/goals", tone: "red" });
  }

  return {
    view: "personal",
    stats: { ...EMPTY_STATS, activeEmployees: employeesRes.count ?? 0 },
    pipeline: EMPTY_PIPELINE,
    trend: [],
    rolePipeline: [],
    stageAging: [],
    teamPulseTrend: [],
    recent: [],
    personal,
    operations: {
      ...EMPTY_OPERATIONS,
      actionItems,
      goals: goalsBreakdown,
      upcomingOneOnOnes: [],
    },
  };
}

// ── Org / Team view ───────────────────────────────────────────────────────────

async function buildOrgOrTeamData(
  range: DashboardRange,
  view: "org" | "team",
  ctx: DashboardContext | undefined
): Promise<DashboardData> {
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

  // ── Determine team scope filters ──────────────────────────────────────────
  let jobIds: string[] | null = null;  // null = no filter (org)
  let directReportIds: string[] | null = null;

  if (view === "team" && ctx) {
    // Fetch job ids in the manager's department
    const { data: deptJobs } = ctx.department
      ? await supabaseAdmin.from("jobs").select("id").eq("department", ctx.department)
      : { data: [] };
    jobIds = (deptJobs ?? []).map((j) => j.id);

    // Fetch direct report ids
    const { data: reports } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("manager_id", ctx.userId)
      .eq("is_active", true);
    directReportIds = (reports ?? []).map((r) => r.id);
  }

  // Build candidate query
  let candidatesQ = supabaseAdmin
    .from("candidates")
    .select("id, full_name, stage, applied_at, ai_score, shortlisted, hired_user_id, jobs(title)");
  if (jobIds !== null && jobIds.length > 0) {
    candidatesQ = candidatesQ.in("job_id", jobIds);
  } else if (jobIds !== null && jobIds.length === 0) {
    // No jobs in this department — return empty
  }

  let rangeCandidatesQ = supabaseAdmin
    .from("candidates")
    .select("id, applied_at")
    .gte("applied_at", start)
    .lte("applied_at", end);
  if (jobIds !== null && jobIds.length > 0) {
    rangeCandidatesQ = rangeCandidatesQ.in("job_id", jobIds);
  }

  let scheduledJobsQ = supabaseAdmin
    .from("jobs")
    .select("id, title, published_at, closes_at")
    .eq("status", "open")
    .or(`published_at.gte.${now.toISOString()},closes_at.gte.${now.toISOString()}`);
  if (jobIds !== null && jobIds.length > 0) {
    scheduledJobsQ = scheduledJobsQ.in("id", jobIds);
  }

  // Build employees query — scoped by manager for team view
  let employeesQ = supabaseAdmin.from("users").select("id", { count: "exact" }).eq("is_active", true);
  if (view === "team" && ctx) {
    employeesQ = supabaseAdmin.from("users").select("id", { count: "exact" }).eq("is_active", true).eq("manager_id", ctx.userId);
  }

  let newHiresQ = supabaseAdmin
    .from("users")
    .select("id, name, job_title, department, start_date")
    .eq("is_active", true)
    .gte("start_date", thirtyDaysAgo)
    .order("start_date", { ascending: false })
    .limit(6);
  if (view === "team" && ctx) {
    newHiresQ = newHiresQ.eq("manager_id", ctx.userId);
  }

  // Build checkins query — scoped by direct reports for team view
  let checkinsQ = supabaseAdmin
    .from("checkins")
    .select("status, mood, blockers")
    .gte("week_start", weekStart.toISOString().slice(0, 10));
  let pulseHistoryQ = supabaseAdmin
    .from("checkins")
    .select("week_start, status, mood")
    .gte("week_start", sixWeeksAgo.toISOString().slice(0, 10))
    .order("week_start");
  if (view === "team" && directReportIds !== null) {
    if (directReportIds.length > 0) {
      checkinsQ = checkinsQ.in("user_id", directReportIds);
      pulseHistoryQ = pulseHistoryQ.in("user_id", directReportIds);
    }
  }

  // Build goals query — scoped by direct reports for team view
  let atRiskGoalsQ = supabaseAdmin.from("goals").select("id").eq("status", "at_risk");
  let allGoalsQ = supabaseAdmin.from("goals").select("id, status");
  if (view === "team" && directReportIds !== null && directReportIds.length > 0) {
    atRiskGoalsQ = atRiskGoalsQ.in("owner_id", directReportIds);
    allGoalsQ = allGoalsQ.in("owner_id", directReportIds);
  }

  // Build 1-on-1 query
  let conversationsQ = supabaseAdmin
    .from("one_on_ones")
    .select("id, scheduled_at, manager:users!one_on_ones_manager_id_fkey(name), report:users!one_on_ones_report_id_fkey(name)")
    .gte("scheduled_at", now.toISOString())
    .order("scheduled_at")
    .limit(5);
  if (view === "team" && ctx) {
    conversationsQ = conversationsQ.eq("manager_id", ctx.userId);
  }

  const [
    rangeCandidatesRes,
    currentJobsRes,
    currentCandidatesRes,
    employeesRes,
    reviewsRes,
    scorecardsRes,
    checkinsRes,
    pulseHistoryRes,
    goalsRes,
    conversationsRes,
    scheduledJobsRes,
    allGoalsRes,
    newHiresRes,
    activeSurveysRes,
  ] = await Promise.all([
    // Only fetch range candidates if we have jobIds or no filter
    jobIds !== null && jobIds.length === 0
      ? Promise.resolve({ data: [] })
      : rangeCandidatesQ,
    supabaseAdmin.from("jobs").select("id, status"),
    jobIds !== null && jobIds.length === 0
      ? Promise.resolve({ data: [] })
      : candidatesQ,
    employeesQ,
    supabaseAdmin
      .from("performance_reviews")
      .select("id", { count: "exact" })
      .gte("created_at", start)
      .lte("created_at", end),
    supabaseAdmin.from("interview_scorecards").select("candidate_id, submitted_at"),
    checkinsQ,
    pulseHistoryQ,
    atRiskGoalsQ,
    conversationsQ,
    scheduledJobsRes_placeholder(scheduledJobsQ),
    allGoalsQ,
    newHiresQ,
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

  // ── Chart series ───────────────────────────────────────────────────────────
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
    const k = checkin.week_start;
    const entry = weeklyPulse.get(k) ?? { checkins: 0, moodTotal: 0, moodCount: 0 };
    if (checkin.status === "submitted" || checkin.status === "reviewed") entry.checkins += 1;
    if (checkin.mood !== null) { entry.moodTotal += checkin.mood; entry.moodCount += 1; }
    weeklyPulse.set(k, entry);
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
    (scorecardsRes.data ?? []).filter((sc) => sc.submitted_at).map((sc) => sc.candidate_id)
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
  const scheduledJobs = ((scheduledJobsRes as { data: Array<{ id: string; title: string; published_at: string | null; closes_at: string | null }> | null }).data ?? []).flatMap((job) => [
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

  const employeeCount = employeesRes.count ?? 0;

  return {
    view,
    stats: {
      openJobs,
      activePipeline,
      pendingScreen,
      activeEmployees: employeeCount,
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
      pulse: { pendingCheckins: Math.max(employeeCount - submittedCheckins, 0), lowMood: checkins.filter((checkin) => (checkin.mood ?? 5) <= 2).length, blockers: checkins.filter((checkin) => !!checkin.blockers?.trim()).length, atRiskGoals: goalsRes.data?.length ?? 0 },
      scheduledJobs,
      goals: goalsBreakdown,
      newHires,
      activeSurveys,
    },
  };
}

// Typed helper to satisfy TypeScript for the scheduledJobs query result
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function scheduledJobsRes_placeholder(q: any): Promise<any> {
  return q;
}
