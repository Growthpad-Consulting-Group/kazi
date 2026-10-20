import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { hasRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { Icon } from "@iconify/react";
import SetPageHeader from "@/components/ui/SetPageHeader";

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
  if (!hasRole(session.user.role, "manager")) redirect("/pulse");

  const isHr = hasRole(session.user.role, "hr");
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

  const [{ data: rawCheckins }, { data: rawGoals }] = await Promise.all([
    supabaseAdmin
      .from("checkins")
      .select("user_id, week_start, mood, blockers, status")
      .in("user_id", memberIds)
      .gte("week_start", fourWeeksAgo),
    supabaseAdmin.from("goals").select("owner_id, status, progress").in("owner_id", memberIds),
  ]);

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
    const submitted = checkins.filter((c) => c.week_start === week).length;
    const pct = members.length > 0 ? Math.round((submitted / members.length) * 100) : 0;
    return { week, pct };
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

  const maxTrend = Math.max(...weeklyTrend.map((w) => w.pct), 1);

  const GOAL_COLORS: Record<string, string> = {
    not_started: "bg-[var(--surface-2)]",
    in_progress: "bg-blue-500",
    at_risk: "bg-amber-500",
    completed: "bg-green-500",
  };

  return (
    <div className="space-y-6">
      <SetPageHeader
        title="Leadership Analytics"
        description={`${isHr ? "Organisation-wide" : "Your team"} · ${members.length} ${members.length === 1 ? "member" : "members"}`}
        icon="solar:chart-broken"
      />

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Check-in Rate"
          value={`${completionRate}%`}
          sub="this week"
          icon="solar:checklist-minimalistic-broken"
          accent={completionRate >= 80 ? "green" : completionRate >= 50 ? "amber" : "red"}
        />
        <KpiCard
          label="Avg Mood"
          value={avgMood ? `${avgMood}/5` : "—"}
          sub="this week"
          icon="solar:emoji-funny-circle-broken"
          accent={avgMood && parseFloat(avgMood) >= 3.5 ? "green" : avgMood ? "amber" : "slate"}
        />
        <KpiCard
          label="Goal Progress"
          value={`${avgProgress}%`}
          sub={`${totalGoals} goals total`}
          icon="solar:target-broken"
          accent={avgProgress >= 70 ? "green" : avgProgress >= 40 ? "amber" : "slate"}
        />
        <KpiCard
          label="Flight Risks"
          value={String(flightRisks.length)}
          sub="need attention"
          icon="solar:danger-broken"
          accent={flightRisks.length === 0 ? "green" : flightRisks.length <= 2 ? "amber" : "red"}
        />
      </div>

      {/* Trend + Goal Distribution */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Check-in Trend */}
        <SectionCard
          icon="solar:graph-up-broken"
          title="Check-in Completion"
          description="Last 4 weeks"
        >
          <div className="flex items-end gap-3 h-36 pt-2">
            {weeklyTrend.map(({ week, pct }) => (
              <div key={week} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="text-xs font-semibold text-[var(--text-lo)] tabular-nums">{pct}%</span>
                <div className="relative w-full rounded-t-lg overflow-hidden" style={{ height: `${Math.round((pct / maxTrend) * 96) + 4}px` }}>
                  <div className="absolute inset-0 bg-[#f05d23]/20 rounded-t-lg" />
                  <div
                    className="absolute bottom-0 w-full rounded-t-lg transition-all duration-500"
                    style={{
                      height: `${Math.max(pct, 4)}%`,
                      background: "linear-gradient(to top, #f05d23, #ff8c5a)",
                    }}
                  />
                </div>
                <span className="text-[10px] text-[var(--text-lo)]">
                  {new Date(week).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Goal Distribution */}
        <SectionCard icon="solar:target-broken" title="Goal Status" description={`${totalGoals} goals tracked`}>
          {totalGoals > 0 ? (
            <div className="space-y-3 pt-1">
              {(Object.entries(goalBuckets) as [string, number][]).map(([status, count]) => {
                const pct = totalGoals > 0 ? Math.round((count / totalGoals) * 100) : 0;
                return (
                  <div key={status} className="flex items-center gap-3">
                    <span className="w-24 text-xs text-[var(--text-lo)] capitalize shrink-0">
                      {status.replace("_", " ")}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${GOAL_COLORS[status]}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-1.5 w-14 justify-end">
                      <span className="text-xs font-semibold text-[var(--text-hi)] tabular-nums">{count}</span>
                      <span className="text-[10px] text-[var(--text-lo)]">({pct}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-[var(--text-lo)]">No goals found.</p>
          )}
        </SectionCard>
      </div>

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
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const ACCENT_STYLES = {
  green: { border: "border-green-200/60 dark:border-green-800/30", icon: "bg-green-500/10 text-green-500", value: "text-green-500" },
  amber: { border: "border-amber-200/60 dark:border-amber-800/30", icon: "bg-amber-500/10 text-amber-500", value: "text-amber-500" },
  red: { border: "border-red-200/60 dark:border-red-800/30", icon: "bg-red-500/10 text-red-500", value: "text-red-400" },
  slate: { border: "border-[var(--border)]", icon: "bg-[var(--surface-2)] text-[var(--text-lo)]", value: "text-[var(--text-hi)]" },
};

function KpiCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  icon: string;
  accent: string;
}) {
  const styles = ACCENT_STYLES[accent as keyof typeof ACCENT_STYLES] ?? ACCENT_STYLES.slate;
  return (
    <div className={`rounded-2xl border bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 hover:shadow-2xl dark:shadow-black/20 transition-all duration-300 ${styles.border}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-[var(--text-lo)]">{label}</p>
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${styles.icon}`}>
          <Icon icon={icon} className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className={`mt-3 font-display text-3xl font-bold tabular-nums ${styles.value}`}>{value}</p>
      <p className="mt-1 text-xs text-[var(--text-lo)]">{sub}</p>
    </div>
  );
}

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
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${isAmber ? "bg-amber-500/10 text-amber-500" : "bg-[#f05d23]/10 text-[#f05d23]"}`}>
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
