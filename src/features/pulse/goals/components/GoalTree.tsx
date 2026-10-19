"use client";

import { useState } from "react";
import type { Goal, GoalStatus } from "@/types/database";

interface Props {
  goals: Goal[];
  childMap: Record<string, Goal[]>;
  canEdit: boolean;
  depth?: number;
}

const STATUS_STYLES: Record<GoalStatus, { dot: string; badge: string }> = {
  not_started: { dot: "bg-slate-300", badge: "bg-slate-100 text-slate-500" },
  in_progress: { dot: "bg-blue-500", badge: "bg-blue-100 text-blue-600" },
  at_risk: { dot: "bg-amber-400", badge: "bg-amber-100 text-amber-700" },
  completed: { dot: "bg-green-500", badge: "bg-green-100 text-green-700" },
  cancelled: { dot: "bg-slate-200", badge: "bg-slate-100 text-slate-400" },
};

export function GoalTree({ goals, childMap, canEdit, depth = 0 }: Props) {
  return (
    <div className={`space-y-2 ${depth > 0 ? "pl-6 border-l border-slate-100 ml-3" : ""}`}>
      {goals.map((g) => (
        <GoalCard
          key={g.id}
          goal={g}
          children={childMap[g.id] ?? []}
          childMap={childMap}
          canEdit={canEdit}
          depth={depth}
        />
      ))}
    </div>
  );
}

function GoalCard({
  goal,
  children,
  childMap,
  canEdit,
  depth,
}: {
  goal: Goal;
  children: Goal[];
  childMap: Record<string, Goal[]>;
  canEdit: boolean;
  depth: number;
}) {
  const [progress, setProgress] = useState(goal.progress);
  const [status, setStatus] = useState<GoalStatus>(goal.status);
  const [saving, setSaving] = useState(false);
  const s = STATUS_STYLES[status];

  async function saveProgress(newProg: number, newStatus: GoalStatus) {
    setSaving(true);
    await fetch("/api/pulse/goals/progress", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: goal.id, progress: newProg, status: newStatus }),
    });
    setSaving(false);
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900 leading-snug">{goal.title}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0 capitalize ${s.badge}`}>
                {status.replace("_", " ")}
              </span>
            </div>
            {goal.description && (
              <p className="text-xs text-slate-500 mt-1">{goal.description}</p>
            )}
            {goal.due_date && (
              <p className="text-xs text-slate-400 mt-1">
                Due {new Date(goal.due_date).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            )}

            {/* Progress bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">Progress</span>
                <span className="text-xs font-semibold text-slate-700">{progress}%</span>
              </div>
              {canEdit ? (
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  onMouseUp={() => saveProgress(progress, status)}
                  onTouchEnd={() => saveProgress(progress, status)}
                  className="w-full accent-blue-600"
                />
              ) : (
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>

            {/* Status selector for editors */}
            {canEdit && (
              <div className="flex gap-1.5 mt-3 flex-wrap">
                {(Object.keys(STATUS_STYLES) as GoalStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setStatus(st);
                      saveProgress(progress, st);
                    }}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors capitalize ${
                      status === st ? STATUS_STYLES[st].badge + " ring-1 ring-inset ring-current" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {st.replace("_", " ")}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Children */}
      {children.length > 0 && (
        <div className="px-4 pb-4">
          <GoalTree goals={children} childMap={childMap} canEdit={canEdit} depth={depth + 1} />
        </div>
      )}
    </div>
  );
}
