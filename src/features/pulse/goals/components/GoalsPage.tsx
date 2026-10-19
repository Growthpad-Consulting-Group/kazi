import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { getGoals } from "../actions";
import { GoalTree } from "./GoalTree";
import { NewGoalButton } from "./NewGoalButton";
import type { Goal, GoalLevel } from "@/types/database";

const LEVEL_ORDER: GoalLevel[] = ["company", "team", "individual"];

const LEVEL_LABELS: Record<GoalLevel, string> = {
  company: "Company",
  team: "Team",
  individual: "Individual",
};

export default async function GoalsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const isAdmin = hasRole(session.user.role, "manager");
  const goals = await getGoals();

  // Build tree: group by level, then nest by parent_id
  const topLevel = goals.filter((g) => !g.parent_id);
  const childMap: Record<string, Goal[]> = {};
  for (const g of goals.filter((g) => g.parent_id)) {
    (childMap[g.parent_id!] ??= []).push(g);
  }

  const byLevel: Record<GoalLevel, Goal[]> = {
    company: topLevel.filter((g) => g.level === "company"),
    team: topLevel.filter((g) => g.level === "team"),
    individual: topLevel.filter((g) => g.level === "individual"),
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Goals & OKRs</h1>
          <p className="mt-1 text-sm text-slate-500">{goals.length} goals across all levels</p>
        </div>
        {isAdmin && <NewGoalButton userId={session.user.id} />}
      </div>

      {LEVEL_ORDER.map((level) => {
        const levelGoals = byLevel[level];
        return (
          <div key={level}>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
              {LEVEL_LABELS[level]} · {levelGoals.length}
            </h2>
            {levelGoals.length === 0 ? (
              <p className="text-sm text-slate-400">No {level} goals yet.</p>
            ) : (
              <GoalTree goals={levelGoals} childMap={childMap} canEdit={isAdmin} />
            )}
          </div>
        );
      })}
    </div>
  );
}
