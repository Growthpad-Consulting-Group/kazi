import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { hasRole } from "@/lib/rbac";
import { redirect } from "next/navigation";

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

  // Fetch all active employees in scope
  const membersQuery = supabaseAdmin.from("users").select("id, name, department, manager_id").eq("is_active", true);
  const { data: allMembers } = isHr
    ? await membersQuery
    : await membersQuery.eq("manager_id", session.user.id);

  const members = (allMembers ?? []) as TeamMember[];
  const memberIds = members.map((m) => m.id);

  if (memberIds.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Leadership Analytics</h1>
        <p className="text-slate-500">No team members found.</p>
      </div>
    );
  }

  const [{ data: rawCheckins }, { data: rawGoals }] = await Promise.all([
    supabaseAdmin
      .from("checkins")
      .select("user_id, week_start, mood, blockers, status")
      .in("user_id", memberIds)
      .gte("week_start", fourWeeksAgo),
    supabaseAdmin
      .from("goals")
      .select("owner_id, status, progress")
      .in("owner_id", memberIds),
  ]);

  const checkins = (rawCheckins ?? []) as Checkin[];
  const goals = (rawGoals ?? []) as Goal[];

  // ── Check-in completion this week ──────────────────────────
  const thisWeekCheckins = checkins.filter((c) => c.week_start === thisWeek);
  const completionRate = members.length > 0
    ? Math.round((thisWeekCheckins.length / members.length) * 100)
    : 0;

  // ── Avg mood this week ──────────────────────────────────────
  const moodsThisWeek = thisWeekCheckins.map((c) => c.mood).filter((m): m is number => m !== null);
  const avgMood = moodsThisWeek.length > 0
    ? (moodsThisWeek.reduce((a, b) => a + b, 0) / moodsThisWeek.length).toFixed(1)
    : null;

  // ── Weekly check-in trend (last 4 weeks) ───────────────────
  const weeklyTrend = Array.from({ length: 4 }, (_, i) => {
    const week = getWeekStart(3 - i);
    const count = checkins.filter((c) => c.week_start === week).length;
    return { week, count, pct: members.length > 0 ? Math.round((count / members.length) * 100) : 0 };
  });

  // ── Goal progress distribution ─────────────────────────────
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

  // ── Flight risk signals ────────────────────────────────────
  const flightRisks = members.filter((m) => isFlightRisk(checkins, m.id));

  // ── Department breakdown (HR only) ────────────────────────
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
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Leadership Analytics</h1>
        <p className="text-sm text-slate-500 mt-1">
          {isHr ? "Organisation-wide" : "Your team"} · {members.length} {members.length === 1 ? "member" : "members"}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Check-in Rate" value={`${completionRate}%`} sub="this week"
          accent={completionRate >= 80 ? "green" : completionRate >= 50 ? "amber" : "red"} />
        <KpiCard label="Avg Mood" value={avgMood ? `${avgMood}/5` : "—"} sub="this week"
          accent={avgMood && parseFloat(avgMood) >= 3.5 ? "green" : avgMood ? "amber" : "slate"} />
        <KpiCard label="Goal Progress" value={`${avgProgress}%`} sub={`across ${totalGoals} goals`}
          accent={avgProgress >= 70 ? "green" : avgProgress >= 40 ? "amber" : "slate"} />
        <KpiCard label="Flight Risks" value={String(flightRisks.length)} sub="need attention"
          accent={flightRisks.length === 0 ? "green" : flightRisks.length <= 2 ? "amber" : "red"} />
      </div>

      {/* Trend chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Check-in Completion — Last 4 Weeks</h2>
        <div className="flex items-end gap-4 h-32">
          {weeklyTrend.map(({ week, pct }) => (
            <div key={week} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs font-medium text-slate-600">{pct}%</span>
              <div className="w-full rounded-t-md bg-blue-500 transition-all" style={{ height: `${Math.max(pct, 4)}%` }} />
              <span className="text-xs text-slate-400">
                {new Date(week).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Goal distribution */}
      {totalGoals > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Goal Status Distribution</h2>
          <div className="space-y-2.5">
            {(Object.entries(goalBuckets) as [string, number][]).map(([status, count]) => {
              const pct = totalGoals > 0 ? Math.round((count / totalGoals) * 100) : 0;
              const colors: Record<string, string> = {
                not_started: "bg-slate-300",
                in_progress: "bg-blue-500",
                at_risk: "bg-amber-500",
                completed: "bg-green-500",
              };
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className="w-24 text-xs text-slate-500 capitalize shrink-0">{status.replace("_", " ")}</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${colors[status]}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-slate-400 w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Flight risk signals */}
      {flightRisks.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Flight Risk Signals</h2>
          <p className="text-xs text-slate-400 mb-4">Employees with 2+ low-mood check-ins or blockers in 3+ of the last 4 weeks</p>
          <div className="space-y-2">
            {flightRisks.map((m) => {
              const recent = checkins
                .filter((c) => c.user_id === m.id)
                .sort((a, b) => b.week_start.localeCompare(a.week_start))
                .slice(0, 4);
              const lowMoods = recent.filter((c) => c.mood !== null && c.mood <= 2).length;
              const blockerWeeks = recent.filter((c) => c.blockers && c.blockers.trim()).length;
              return (
                <div key={m.id} className="flex items-center gap-4 rounded-lg bg-amber-50 px-4 py-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{m.name}</p>
                    {m.department && <p className="text-xs text-slate-400">{m.department}</p>}
                  </div>
                  <div className="flex gap-2">
                    {lowMoods >= 2 && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                        Low mood ×{lowMoods}
                      </span>
                    )}
                    {blockerWeeks >= 3 && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Blockers ×{blockerWeeks}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Department breakdown (HR only) */}
      {isHr && Object.keys(deptMap).length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Department Breakdown</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-100">
                  <th className="text-left pb-2 font-medium">Department</th>
                  <th className="text-right pb-2 font-medium">Headcount</th>
                  <th className="text-right pb-2 font-medium">Check-ins</th>
                  <th className="text-right pb-2 font-medium">Avg Mood</th>
                  <th className="text-right pb-2 font-medium">At Risk</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(deptMap).map(([dept, stats]) => {
                  const mood = stats.avgMood.length > 0
                    ? (stats.avgMood.reduce((a, b) => a + b, 0) / stats.avgMood.length).toFixed(1)
                    : "—";
                  const deptRate = Math.round((stats.submitted / stats.total) * 100);
                  return (
                    <tr key={dept} className="border-b border-slate-50 last:border-0">
                      <td className="py-2.5 font-medium text-slate-700">{dept}</td>
                      <td className="py-2.5 text-right text-slate-500">{stats.total}</td>
                      <td className="py-2.5 text-right">
                        <span className={deptRate >= 80 ? "text-green-600" : deptRate >= 50 ? "text-amber-600" : "text-red-500"}>
                          {deptRate}%
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-slate-500">{mood}</td>
                      <td className="py-2.5 text-right">
                        {stats.atRisk > 0 ? (
                          <span className="text-amber-600 font-medium">{stats.atRisk}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  const border: Record<string, string> = {
    green: "border-green-200",
    amber: "border-amber-200",
    red: "border-red-200",
    slate: "border-slate-200",
  };
  const text: Record<string, string> = {
    green: "text-green-600",
    amber: "text-amber-600",
    red: "text-red-500",
    slate: "text-slate-700",
  };
  return (
    <div className={`rounded-xl border bg-white p-5 shadow-sm ${border[accent] ?? "border-slate-200"}`}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${text[accent] ?? "text-slate-700"}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-1">{sub}</p>
    </div>
  );
}
