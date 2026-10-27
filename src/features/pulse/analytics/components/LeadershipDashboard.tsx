import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { can, canView } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { Icon } from "@iconify/react";
import SetPageHeader from "@/components/ui/SetPageHeader";
import StatCard from "@/components/ui/StatCard";
import { PulseAnalyticsCharts } from "./PulseAnalyticsCharts";
import TopPerformersSection from "./TopPerformersSection";
import type { TopPerformerEntry } from "./TopPerformersSection";

type TeamMember = { id: string; name: string; department: string | null; manager_id: string | null };
type Checkin = { user_id: string; week_start: string; mood: number | null; blockers: string | null; status: string };
type Goal = { owner_id: string | null; status: string; progress: number };

function getWeekStart(weeksAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1 - weeksAgo * 7);
  return d.toISOString().split("T")[0];
}

function isFlightRisk(checkins: Checkin[], userId: string) {
  const recent = checkins
    .filter((c) => c.user_id === userId)
    .sort((a, b) => b.week_start.localeCompare(a.week_start))
    .slice(0, 4);
  if (recent.length < 2) return false;
  const lowMood = recent.filter((c) => c.mood !== null && c.mood <= 2).length;
  const hasBlockers = recent.filter((c) => c.blockers && c.blockers.trim().length > 0).length;
  return lowMood >= 2 || hasBlockers >= 3;
}

export default async function LeadershipDashboard() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  if (!canView(session.user, "view_analytics")) redirect("/pulse");

  const isHr = can(session.user.role, "manage_surveys");
  const thisWeek = getWeekStart(0);
  const fourWeeksAgo = getWeekStart(4);

  const membersQuery = supabaseAdmin.from("users").select("id, name, department, manager_id").eq("is_active", true);
  const { data: allMembers } = isHr
    ? await membersQuery
    : await membersQuery.eq("manager_id", session.user.id);

  const members = (allMembers ?? []) as TeamMember[];
  const memberIds = members.map((m) => m.id);

  if (memberIds.length === 0) {
    return (
      <div className="space-y-6">
        <SetPageHeader
          title="Leadership Analytics"
          description="Team engagement and performance insights"
          icon="solar:chart-broken"
        />
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/50 hover:shadow-2xl dark:shadow-black/20 p-12 text-center transition-shadow duration-200">
          <Icon icon="solar:users-group-broken" className="mx-auto h-10 w-10 text-[var(--text-lo)] opacity-40" />
          <p className="mt-3 text-sm text-[var(--text-lo)]">No team members found.</p>
        </div>
      </div>
    );
  }

  const [
    { data: rawCheckins },
    { data: rawGoals },
    { data: optedOutRows },
    { data: rewardRows },
    { data: latestCycleRows },
  ] = await Promise.all([
    supabaseAdmin
      .from("checkins")
      .select("user_id, week_start, mood, blockers, status")
      .in("user_id", memberIds)
      .gte("week_start", fourWeeksAgo),
    supabaseAdmin.from("goals").select("owner_id, status, progress").in("owner_id", memberIds),
    // Gap 4: opt-out set
    supabaseAdmin
      .from("engagement_notification_preferences")
      .select("user_id")
      .eq("show_on_leaderboard", false)
      .in("user_id", memberIds),
    // Gap 4: reward ledger totals
    supabaseAdmin
      .from("reward_ledger")
      .select("user_id, amount")
      .in("user_id", memberIds),
    // Gap 4: latest review cycle
    supabaseAdmin
      .from("review_cycles")
      .select("id")
      .order("start_date", { ascending: false })
      .limit(1),
  ]);

  // Fetch performance reviews for the latest cycle (if one exists)
  const latestCycleId = (latestCycleRows ?? [])[0]?.id ?? null;
  const { data: reviewRows } = latestCycleId
    ? await supabaseAdmin
        .from("performance_reviews")
        .select("reviewee_id, overall_rating")
        .eq("cycle_id", latestCycleId)
        .not("overall_rating", "is", null)
        .in("reviewee_id", memberIds)
    : { data: [] };

  const checkins = (rawCheckins ?? []) as Checkin[];
  const goals = (rawGoals ?? []) as Goal[];

  const thisWeekCheckins = checkins.filter((c) => c.week_start === thisWeek);
  const completionRate = members.length > 0
    ? Math.round((thisWeekCheckins.length / members.length) * 100)
    : 0;

  const moodsThisWeek = thisWeekCheckins.map((c) => c.mood).filter((m): m is number => m !== null);
  const avgMood = moodsThisWeek.length > 0
    ? (moodsThisWeek.reduce((a, b) => a + b, 0) / moodsThisWeek.length).toFixed(1)
    : null;

  const weeklyTrend = Array.from({ length: 4 }, (_, i) => {
    const week = getWeekStart(3 - i);
    const weekCheckins = checkins.filter((c) => c.week_start === week);
    const submitted = weekCheckins.length;
    const pct = members.length > 0 ? Math.round((submitted / members.length) * 100) : 0;
    const weekMoods = weekCheckins.map((checkin) => checkin.mood).filter((mood): mood is number => mood !== null);
    const mood = weekMoods.length ? Math.round((weekMoods.reduce((total, value) => total + value, 0) / weekMoods.length) * 10) / 10 : null;
    return { week, label: new Date(`${week}T12:00:00`).toLocaleDateString("en-KE", { day: "numeric", month: "short" }), rate: pct, mood };
  });

  const goalBuckets = {
    not_started: goals.filter((g) => g.status === "not_started").length,
    in_progress: goals.filter((g) => g.status === "in_progress").length,
    at_risk: goals.filter((g) => g.status === "at_risk").length,
    completed: goals.filter((g) => g.status === "completed").length,
  };
  const totalGoals = Object.values(goalBuckets).reduce((a, b) => a + b, 0);
  const avgProgress = goals.length > 0
    ? Math.round(goals.reduce((a, g) => a + g.progress, 0) / goals.length)
    : 0;

  const flightRisks = members.filter((m) => isFlightRisk(checkins, m.id));

  // ── Gap 4: Top Performers ─────────────────────────────────────────────────
  const membersMap = new Map(members.map((m) => [m.id, m]));
  const optedOutSet = new Set((optedOutRows ?? []).map((r) => r.user_id));

  // 1. Reward points — sum positive amounts per user
  const rewardTotals = new Map<string, number>();
  for (const row of rewardRows ?? []) {
    if (row.amount > 0) {
      rewardTotals.set(row.user_id, (rewardTotals.get(row.user_id) ?? 0) + row.amount);
    }
  }
  const topRewardPoints: TopPerformerEntry[] = [...rewardTotals.entries()]
    .filter(([id]) => !optedOutSet.has(id) && membersMap.has(id))
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([id, total]) => ({
      id,
      name: membersMap.get(id)!.name,
      department: membersMap.get(id)!.department,
      score: total,
      scoreLabel: `${total.toLocaleString()} pts`,
    }));

  // 2. Goal completion rate — completed/total per owner, min 3 goals
  const goalsByOwner = new Map<string, { completed: number; total: number }>();
  for (const g of goals) {
    if (!g.owner_id) continue;
    const entry = goalsByOwner.get(g.owner_id) ?? { completed: 0, total: 0 };
    entry.total += 1;
    if (g.status === "completed") entry.completed += 1;
    goalsByOwner.set(g.owner_id, entry);
  }
  const topGoalCompletion: TopPerformerEntry[] = [...goalsByOwner.entries()]
    .filter(([id, v]) => v.total >= 3 && !optedOutSet.has(id) && membersMap.has(id))
    .map(([id, v]) => ({
      id,
      rate: v.completed / v.total,
      name: membersMap.get(id)!.name,
      department: membersMap.get(id)!.department,
    }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 10)
    .map(({ id, rate, name, department }) => ({
      id,
      name,
      department,
      score: rate,
      scoreLabel: `${Math.round(rate * 100)}%`,
    }));

  // 3. Review ratings — avg overall_rating per reviewee in latest cycle
  const reviewRatingsByUser = new Map<string, { total: number; count: number }>();
  for (const r of reviewRows ?? []) {
    if (r.overall_rating === null) continue;
    const entry = reviewRatingsByUser.get(r.reviewee_id) ?? { total: 0, count: 0 };
    entry.total += r.overall_rating;
    entry.count += 1;
    reviewRatingsByUser.set(r.reviewee_id, entry);
  }
  const topReviewRatings: TopPerformerEntry[] = [...reviewRatingsByUser.entries()]
    .filter(([id]) => !optedOutSet.has(id) && membersMap.has(id))
    .map(([id, v]) => ({ id, avg: v.total / v.count }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 10)
    .map(({ id, avg }) => ({
      id,
      name: membersMap.get(id)!.name,
      department: membersMap.get(id)!.department,
      score: avg,
      scoreLabel: `${avg.toFixed(1)} / 5`,
    }));

  const deptMap: Record<string, { total: number; submitted: number; avgMood: number[]; atRisk: number }> = {};
  if (isHr) {
    for (const m of members) {
      const dept = m.department ?? "Unknown";
      if (!deptMap[dept]) deptMap[dept] = { total: 0, submitted: 0, avgMood: [], atRisk: 0 };
      deptMap[dept].total++;
      const checkin = thisWeekCheckins.find((c) => c.user_id === m.id);
      if (checkin) {
        deptMap[dept].submitted++;
        if (checkin.mood) deptMap[dept].avgMood.push(checkin.mood);
      }
      if (isFlightRisk(checkins, m.id)) deptMap[dept].atRisk++;
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <SetPageHeader
        title="Leadership Analytics"
        description={`${isHr ? "Organisation-wide" : "Your team"} · ${members.length} ${members.length === 1 ? "member" : "members"}`}
        icon="solar:chart-broken"
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="Check-in rate" value={`${completionRate}%`} icon="solar:checklist-minimalistic-broken" color={completionRate >= 80 ? "green" : completionRate >= 50 ? "amber" : "red"} compact subtitle="Submitted this week" />
        <StatCard title="Average mood" value={avgMood ? `${avgMood}/5` : "—"} icon="solar:emoji-funny-circle-broken" color={avgMood && parseFloat(avgMood) >= 3.5 ? "green" : avgMood ? "amber" : "slate"} compact subtitle="From this week’s check-ins" />
        <StatCard title="Goal progress" value={`${avgProgress}%`} icon="solar:target-broken" color={avgProgress >= 70 ? "green" : avgProgress >= 40 ? "amber" : "blue"} compact subtitle={`${totalGoals} goals tracked`} />
        <StatCard title="Attention signals" value={flightRisks.length} icon="solar:danger-triangle-broken" color={flightRisks.length === 0 ? "green" : flightRisks.length <= 2 ? "amber" : "red"} compact subtitle={flightRisks.length ? "Need a conversation" : "No signals detected"} />
      </section>

      <PulseAnalyticsCharts trend={weeklyTrend} goals={Object.entries(goalBuckets).map(([status, count]) => ({ status, count }))} />

      {/* Flight Risk */}
      {flightRisks.length > 0 && (
        <SectionCard
          icon="solar:danger-triangle-broken"
          title="Flight Risk Signals"
          description="Employees with 2+ low-mood check-ins or blockers in 3+ of the last 4 weeks"
          accent="amber"
        >
          <div className="space-y-2">
            {flightRisks.map((m) => {
              const recent = checkins
                .filter((c) => c.user_id === m.id)
                .sort((a, b) => b.week_start.localeCompare(a.week_start))
                .slice(0, 4);
              const lowMoods = recent.filter((c) => c.mood !== null && c.mood <= 2).length;
              const blockerWeeks = recent.filter((c) => c.blockers && c.blockers.trim()).length;
              const initials = m.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
              return (
                <div key={m.id} className="flex items-center gap-3 rounded-xl border border-amber-200/60 dark:border-amber-800/30 bg-amber-50/40 dark:bg-amber-900/10 px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-200 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300 text-xs font-bold">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-hi)] truncate">{m.name}</p>
                    {m.department && <p className="text-xs text-[var(--text-lo)]">{m.department}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {lowMoods >= 2 && (
                      <span className="rounded-full bg-red-100 dark:bg-red-900/20 border border-red-200/60 dark:border-red-800/40 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                        Low mood ×{lowMoods}
                      </span>
                    )}
                    {blockerWeeks >= 3 && (
                      <span className="rounded-full bg-amber-100 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-800/40 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                        Blockers ×{blockerWeeks}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Department Breakdown — HR only */}
      {isHr && Object.keys(deptMap).length > 0 && (
        <SectionCard icon="solar:buildings-broken" title="Department Breakdown" description="Check-in completion by department">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {["Department", "Headcount", "Check-ins", "Avg Mood", "At Risk"].map((h) => (
                    <th
                      key={h}
                      className={`pb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-lo)] ${h === "Department" ? "text-left" : "text-right"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {Object.entries(deptMap).map(([dept, stats]) => {
                  const mood = stats.avgMood.length > 0
                    ? (stats.avgMood.reduce((a, b) => a + b, 0) / stats.avgMood.length).toFixed(1)
                    : "—";
                  const deptRate = Math.round((stats.submitted / stats.total) * 100);
                  return (
                    <tr key={dept} className="hover:bg-[var(--surface-2)] transition-colors">
                      <td className="py-3 font-medium text-[var(--text-hi)]">{dept}</td>
                      <td className="py-3 text-right text-[var(--text-lo)] tabular-nums">{stats.total}</td>
                      <td className="py-3 text-right tabular-nums">
                        <span className={`font-medium ${deptRate >= 80 ? "text-green-500" : deptRate >= 50 ? "text-amber-500" : "text-red-400"}`}>
                          {deptRate}%
                        </span>
                      </td>
                      <td className="py-3 text-right text-[var(--text-lo)] tabular-nums">{mood}</td>
                      <td className="py-3 text-right tabular-nums">
                        {stats.atRisk > 0 ? (
                          <span className="font-medium text-amber-500">{stats.atRisk}</span>
                        ) : (
                          <span className="text-[var(--text-lo)] opacity-30">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Top Performers */}
      <TopPerformersSection
        rewardPoints={topRewardPoints}
        goalCompletion={topGoalCompletion}
        reviewRatings={topReviewRatings}
      />
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionCard({
  icon,
  title,
  description,
  accent,
  children,
}: {
  icon: string;
  title: string;
  description?: string;
  accent?: string;
  children: React.ReactNode;
}) {
  const isAmber = accent === "amber";
  return (
    <div className={`rounded-2xl border shadow-xl shadow-slate-200/50 hover:shadow-2xl dark:shadow-black/20 transition-all duration-300 ${isAmber ? "border-amber-200/60 dark:border-amber-800/30 bg-[var(--surface)]" : "border-[var(--border)] bg-[var(--surface)]"}`}>
      <div className={`flex items-center gap-3 border-b px-6 py-4 ${isAmber ? "border-amber-100 dark:border-amber-800/20" : "border-[var(--border)]"}`}>
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${isAmber ? "bg-amber-500/10 text-amber-500" : "bg-brand-500/10 text-brand-500"}`}>
          <Icon icon={icon} className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-md font-semibold text-[var(--text-hi)]">{title}</h3>
          {description && <p className="text-xs text-[var(--text-lo)]">{description}</p>}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}
