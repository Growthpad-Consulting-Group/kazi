"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import type { Goal, GoalStatus } from "@/types/database";
import { GoalActions } from "./GoalActions";

interface Props {
  goals: Goal[];
  childMap: Record<string, Goal[]>;
  manageableGoalIds: string[];
  viewerId: string;
  depth?: number;
}

const STATUS: Record<
  GoalStatus,
  { label: string; dot: string; bar: string; badge: string }
> = {
  not_started: {
    label: "Not started",
    dot: "bg-slate-400",
    bar: "bg-slate-400",
    badge: "bg-slate-500/10 text-slate-500",
  },
  in_progress: {
    label: "In progress",
    dot: "bg-blue-500",
    bar: "bg-blue-500",
    badge: "bg-blue-500/10 text-blue-600",
  },
  at_risk: {
    label: "At risk",
    dot: "bg-amber-500",
    bar: "bg-amber-500",
    badge: "bg-amber-500/10 text-amber-600",
  },
  completed: {
    label: "Completed",
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-600",
  },
  cancelled: {
    label: "Cancelled",
    dot: "bg-slate-300",
    bar: "bg-slate-300",
    badge: "bg-slate-500/10 text-slate-400",
  },
};

export function GoalTree({
  goals,
  childMap,
  manageableGoalIds,
  viewerId,
  depth = 0,
}: Props) {
  return (
    <div
      className={
        depth
          ? "mt-2 space-y-2 border-l-2 border-[var(--border)] pl-4"
          : "space-y-2"
      }
    >
      {goals.map((goal) => (
        <GoalCard
          key={goal.id}
          goal={goal}
          linkedGoals={childMap[goal.id] ?? []}
          childMap={childMap}
          manageableGoalIds={manageableGoalIds}
          viewerId={viewerId}
          depth={depth}
        />
      ))}
    </div>
  );
}

function GoalCard({
  goal,
  linkedGoals,
  childMap,
  manageableGoalIds,
  viewerId,
  depth,
}: {
  goal: Goal;
  linkedGoals: Goal[];
  childMap: Record<string, Goal[]>;
  manageableGoalIds: string[];
  viewerId: string;
  depth: number;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState(goal.progress);
  const [currentValue, setCurrentValue] = useState(goal.current_value ?? 0);
  const [status, setStatus] = useState<GoalStatus>(goal.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const meta = STATUS[status];
  const due = dueLabel(goal.due_date);
  const overdue = due?.includes("overdue") ?? false;
  const canManage = manageableGoalIds.includes(goal.id);
  const canUpdate =
    canManage || (goal.level === "individual" && goal.owner_id === viewerId);

  async function save(
    nextProgress: number,
    nextStatus: GoalStatus,
    nextCurrentValue?: number,
  ) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/pulse/goals/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: goal.id,
          progress: nextProgress,
          status: nextStatus,
          ...(nextCurrentValue !== undefined
            ? { current_value: nextCurrentValue }
            : {}),
        }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError("Could not save.");
    } finally {
      setSaving(false);
    }
  }

  const metricLabel = goal.target_value
    ? `${formatMetric(currentValue)} / ${formatMetric(goal.target_value)}${goal.target_unit ? ` ${goal.target_unit}` : ""}`
    : null;

  return (
    <div
      className={`rounded-xl border border-[var(--border)] bg-[var(--surface)] transition-shadow hover:shadow-sm ${depth > 0 ? "bg-[var(--surface-2)]" : ""}`}
    >
      <div className="p-3.5 sm:p-4">
        {/* Header row */}
        <div className="flex items-start gap-3">
          {/* Status dot */}
          <span
            className={`mt-[5px] h-2 w-2 shrink-0 rounded-full ${meta.dot}`}
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm font-semibold leading-snug text-[var(--text-hi)]">
                {goal.title}
              </p>
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold ${meta.badge}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                {meta.label}
              </span>
              {canManage && <GoalActions goal={goal} />}
            </div>

            {goal.description && (
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--text-lo)]">
                {goal.description}
              </p>
            )}

            {/* Meta row */}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              {due && (
                <span
                  className={`inline-flex items-center gap-1 text-[11px] ${overdue && status !== "completed" ? "text-red-500 font-semibold" : "text-[var(--text-lo)]"}`}
                >
                  <Icon icon="solar:calendar-broken" className="h-3.5 w-3.5" />
                  {due}
                </span>
              )}
              {overdue && status !== "completed" && (
                <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-500">
                  <Icon
                    icon="solar:danger-triangle-broken"
                    className="h-3 w-3"
                  />
                  Past due
                </span>
              )}
              {linkedGoals.length > 0 && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="inline-flex items-center gap-1 text-[11px] text-[var(--text-lo)] hover:text-[var(--text-hi)] transition-colors"
                >
                  <Icon
                    icon={
                      expanded
                        ? "solar:alt-arrow-up-broken"
                        : "solar:alt-arrow-down-broken"
                    }
                    className="h-3 w-3"
                  />
                  {linkedGoals.length} sub-goal
                  {linkedGoals.length === 1 ? "" : "s"}
                </button>
              )}
            </div>

            {/* Progress bar */}
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] text-[var(--text-lo)]">
                  Progress
                </span>
                <span className="font-mono text-[11px] font-bold text-[var(--text-hi)]">
                  {progress}%
                </span>
              </div>
              {metricLabel ? (
                <div className="space-y-2">
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                    <div
                      className={`h-full rounded-full transition-all ${meta.bar}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[var(--text-lo)]">
                      {metricLabel}
                    </span>
                    {canUpdate && (
                      <input
                        aria-label={`Current value for ${goal.title}`}
                        type="number"
                        min="0"
                        step="any"
                        value={currentValue}
                        disabled={saving}
                        onChange={(event) =>
                          setCurrentValue(Number(event.target.value))
                        }
                        onBlur={() => save(progress, status, currentValue)}
                        className="w-20 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-right font-mono text-xs text-[var(--text-hi)] outline-none focus:border-brand-500/60"
                      />
                    )}
                  </div>
                </div>
              ) : canUpdate ? (
                <input
                  aria-label={`Progress for ${goal.title}`}
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={progress}
                  disabled={saving}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  onPointerUp={(e) =>
                    save(Number(e.currentTarget.value), status)
                  }
                  onKeyUp={(e) => {
                    if (
                      ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
                    )
                      save(Number(e.currentTarget.value), status);
                  }}
                  className="goal-progress-slider w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #38bdf8 ${progress}%, var(--surface-2) ${progress}%, var(--surface-2) 100%)`,
                  }}
                />
              ) : (
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <div
                    className={`h-full rounded-full transition-all ${meta.bar}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>

            {/* Status + saving row (manager only) */}
            {canUpdate && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  value={status}
                  disabled={saving}
                  onChange={(e) => {
                    const next = e.target.value as GoalStatus;
                    setStatus(next);
                    save(progress, next);
                  }}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-xs font-medium text-[var(--text-hi)] outline-none focus:border-brand-500/60"
                >
                  <option value="not_started">Not started</option>
                  <option value="in_progress">In progress</option>
                  <option value="at_risk">At risk</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                {saving && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-lo)]">
                    <Icon
                      icon="solar:spinner-broken"
                      className="h-3.5 w-3.5 animate-spin"
                    />
                    Saving…
                  </span>
                )}
                {error && (
                  <span className="text-[11px] text-red-500">{error}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sub-goals */}
      {linkedGoals.length > 0 && expanded && (
        <div className="border-t border-[var(--border)] px-4 pb-4 pt-3">
          <GoalTree
            goals={linkedGoals}
            childMap={childMap}
            manageableGoalIds={manageableGoalIds}
            viewerId={viewerId}
            depth={depth + 1}
          />
        </div>
      )}
    </div>
  );
}

function dueLabel(date: string | null) {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${date}T12:00:00`);
  due.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days <= 7) return `Due in ${days}d`;
  return `Due ${due.toLocaleDateString("en-KE", { day: "numeric", month: "short" })}`;
}

function formatMetric(value: number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(
    value,
  );
}
