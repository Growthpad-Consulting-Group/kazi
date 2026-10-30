import { Icon } from "@iconify/react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import SetPageHeader from "@/components/ui/SetPageHeader";
import StatCard from "@/components/ui/StatCard";
import { getGoals } from "../actions";
import { GoalTree } from "./GoalTree";
import { NewGoalButton } from "./NewGoalButton";
import { supabaseAdmin } from "@/lib/supabase";
import { canManageGoal } from "@/lib/goal-permissions";
import type { Goal, GoalLevel, User } from "@/types/database";

const LEVEL_ORDER: GoalLevel[] = ["company", "team", "individual"];
const LEVEL_META: Record<
  GoalLevel,
  { title: string; description: string; icon: string; color: string }
> = {
  company: {
    title: "Company",
    description: "Organisation-wide outcomes",
    icon: "solar:buildings-2-broken",
    color: "text-violet-500 bg-violet-500/10",
  },
  team: {
    title: "Team",
    description: "Function & squad commitments",
    icon: "solar:users-group-two-rounded-broken",
    color: "text-blue-500 bg-blue-500/10",
  },
  individual: {
    title: "Individual",
    description: "Personal performance outcomes",
    icon: "solar:user-rounded-broken",
    color: "text-[#f05d23] bg-[#f05d23]/10",
  },
};

export default async function GoalsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const canEdit = can(session.user.role, "manage_goals");
  const allGoals = await getGoals();
  const goals = allGoals.filter(
    (goal) =>
      goal.level !== "individual" ||
      canEdit ||
      goal.owner_id === session.user.id,
  );
  const { data: staffData } = await supabaseAdmin
    .from("users")
    .select("id, name, manager_id")
    .eq("is_active", true)
    .order("name");
  const staff = (staffData ?? []) as Pick<User, "id" | "name" | "manager_id">[];
  const owners = !["admin", "hr", "manager"].includes(session.user.role)
    ? staff.filter((user) => user.id === session.user.id)
    : session.user.role === "manager"
      ? staff.filter(
          (user) =>
            user.id === session.user.id || user.manager_id === session.user.id,
        )
      : staff;
  const parentGoals = allGoals.filter((goal) => {
    if (session.user.role === "admin" || session.user.role === "hr")
      return true;
    if (session.user.role === "manager") {
      if (goal.level === "company") return true;
      return (
        goal.created_by === session.user.id || goal.owner_id === session.user.id
      );
    }
    return goal.level === "company" || goal.level === "team";
  });
  const manageableGoalIds = (
    await Promise.all(
      goals.map(async (goal) =>
        (await canManageGoal(
          { id: session.user.id, role: session.user.role },
          goal,
        ))
          ? goal.id
          : null,
      ),
    )
  ).filter((id): id is string => Boolean(id));
  const active = goals.filter(
    (g) => !["completed", "cancelled"].includes(g.status),
  );
  const atRisk = active.filter((g) => g.status === "at_risk");
  const completed = goals.filter((g) => g.status === "completed");
  const avgProg = active.length
    ? Math.round(active.reduce((s, g) => s + g.progress, 0) / active.length)
    : 0;

  const topLevel = goals.filter((g) => !g.parent_id);
  const childMap: Record<string, Goal[]> = {};
  for (const g of goals.filter((g) => g.parent_id))
    (childMap[g.parent_id!] ??= []).push(g);
  const byLevel: Record<GoalLevel, Goal[]> = {
    company: topLevel.filter((g) => g.level === "company"),
    team: topLevel.filter((g) => g.level === "team"),
    individual: topLevel.filter((g) => g.level === "individual"),
  };

  const circumference = 2 * Math.PI * 26;
  const dashOffset = circumference - (avgProg / 100) * circumference;

  return (
    <>
      <SetPageHeader
        title="Goals & OKRs"
        description={`${active.length} active · ${atRisk.length} at risk · ${completed.length} completed`}
        icon="solar:target-broken"
        trailing={
          <NewGoalButton
            userId={session.user.id}
            role={session.user.role}
            owners={owners.map(({ id, name }) => ({ id, name }))}
            parentGoals={parentGoals.map(({ id, title, level }) => ({
              id,
              title,
              level,
            }))}
            size="sm"
          />
        }
      />

      <div className="mx-auto max-w-7xl space-y-6">
        {/* Summary strip */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            variant="flat"
            compact
            title="Active goals"
            value={active.length}
            subtitle={`${goals.length} total`}
            icon="solar:target-broken"
            color="orange"
          />
          <StatCard
            variant="flat"
            compact
            title="Avg. progress"
            value={`${avgProg}%`}
            subtitle="Across active goals"
            icon="solar:chart-2-broken"
            color="blue"
          />
          <StatCard
            variant="flat"
            compact
            title="Needs attention"
            value={atRisk.length}
            subtitle={atRisk.length ? "Marked at risk" : "All on track"}
            icon="solar:danger-triangle-broken"
            color={atRisk.length ? "amber" : "green"}
          />
          <StatCard
            variant="flat"
            compact
            title="Completed"
            value={completed.length}
            subtitle={`${goals.length ? Math.round((completed.length / goals.length) * 100) : 0}% of all`}
            icon="solar:check-circle-broken"
            color="green"
          />
        </div>

        {/* Main content */}
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          {/* Goal levels */}
          <div className="space-y-4">
            {LEVEL_ORDER.map((level) => {
              const meta = LEVEL_META[level];
              const items = byLevel[level];
              return (
                <section
                  key={level}
                  className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
                >
                  <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[var(--border)] bg-[var(--surface-2)]/50">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-lg ${meta.color}`}
                      >
                        <Icon icon={meta.icon} className="h-3.5 w-3.5" />
                      </span>
                      <div>
                        <h2 className="text-sm font-semibold text-[var(--text-hi)]">
                          {meta.title}
                        </h2>
                        <p className="text-[11px] text-[var(--text-lo)]">
                          {meta.description}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-[var(--surface-2)] border border-[var(--border)] px-2.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--text-lo)]">
                      {items.length}
                    </span>
                  </div>
                  <div className="p-4">
                    {items.length ? (
                      <GoalTree
                        goals={items}
                        childMap={childMap}
                        manageableGoalIds={manageableGoalIds}
                        viewerId={session.user.id}
                      />
                    ) : (
                      <div className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] text-center">
                        <Icon
                          icon={meta.icon}
                          className="h-5 w-5 text-[var(--text-lo)]"
                        />
                        <p className="text-xs text-[var(--text-lo)]">
                          No {meta.title.toLowerCase()} goals yet
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            {/* Progress ring */}
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                  <Icon icon="solar:chart-2-broken" className="h-4 w-4" />
                </span>
                <h2 className="text-sm font-semibold text-[var(--text-hi)]">
                  Overall progress
                </h2>
              </div>
              <div className="flex items-center gap-5">
                <svg
                  width="72"
                  height="72"
                  viewBox="0 0 60 60"
                  className="shrink-0 -rotate-90"
                >
                  <circle
                    cx="30"
                    cy="30"
                    r="26"
                    fill="none"
                    stroke="var(--surface-2)"
                    strokeWidth="6"
                  />
                  <circle
                    cx="30"
                    cy="30"
                    r="26"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    style={{ transition: "stroke-dashoffset 0.6s ease" }}
                  />
                </svg>
                <div>
                  <p className="font-mono text-3xl font-bold text-[var(--text-hi)]">
                    {avgProg}%
                  </p>
                  <p className="text-xs text-[var(--text-lo)]">
                    Average across {active.length} active goal
                    {active.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {(
                  [
                    [
                      "On track",
                      active.filter((g) => g.status === "in_progress").length,
                      "text-blue-500",
                    ],
                    [
                      "Not started",
                      active.filter((g) => g.status === "not_started").length,
                      "text-slate-400",
                    ],
                    ["At risk", atRisk.length, "text-amber-500"],
                  ] as [string, number, string][]
                ).map(([label, count, cls]) => (
                  <div
                    key={label}
                    className="rounded-xl bg-[var(--surface-2)] py-2 px-1"
                  >
                    <p className={`font-mono text-lg font-bold ${cls}`}>
                      {count}
                    </p>
                    <p className="text-[10px] text-[var(--text-lo)]">{label}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* At risk */}
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                    <Icon
                      icon="solar:danger-triangle-broken"
                      className="h-4 w-4"
                    />
                  </span>
                  <h2 className="text-sm font-semibold text-[var(--text-hi)]">
                    Needs attention
                  </h2>
                </div>
                {atRisk.length > 0 && (
                  <span className="font-mono text-xs font-bold text-amber-500">
                    {atRisk.length}
                  </span>
                )}
              </div>
              {atRisk.length ? (
                <ul className="space-y-2">
                  {atRisk.slice(0, 5).map((goal) => (
                    <li
                      key={goal.id}
                      className="rounded-xl border border-amber-500/15 bg-amber-500/[0.05] px-3 py-2.5"
                    >
                      <p className="line-clamp-1 text-xs font-semibold text-[var(--text-hi)]">
                        {goal.title}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-amber-500/20">
                          <div
                            className="h-full rounded-full bg-amber-500"
                            style={{ width: `${goal.progress}%` }}
                          />
                        </div>
                        <span className="font-mono text-[10px] font-bold text-amber-600 dark:text-amber-400">
                          {goal.progress}%
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-xl bg-emerald-500/[0.06] py-5 text-center">
                  <Icon
                    icon="solar:check-circle-broken"
                    className="h-5 w-5 text-emerald-500"
                  />
                  <p className="text-xs font-medium text-[var(--text-hi)]">
                    All goals on track
                  </p>
                  <p className="text-[11px] text-[var(--text-lo)]">
                    Nothing marked at risk.
                  </p>
                </div>
              )}
            </section>

            {/* Completion */}
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                  <Icon icon="solar:check-circle-broken" className="h-4 w-4" />
                </span>
                <h2 className="text-sm font-semibold text-[var(--text-hi)]">
                  Completion
                </h2>
              </div>
              <div className="space-y-3">
                {(["company", "team", "individual"] as GoalLevel[]).map(
                  (level) => {
                    const all = goals.filter((g) => g.level === level);
                    const done = all.filter((g) => g.status === "completed");
                    const pct = all.length
                      ? Math.round((done.length / all.length) * 100)
                      : 0;
                    const meta = LEVEL_META[level];
                    return (
                      <div key={level} className="flex items-center gap-3">
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${meta.color}`}
                        >
                          <Icon icon={meta.icon} className="h-3 w-3" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-[var(--text-lo)] capitalize">
                              {level}
                            </span>
                            <span className="font-mono text-[10px] font-bold text-[var(--text-lo)]">
                              {done.length}/{all.length}
                            </span>
                          </div>
                          <div className="h-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
