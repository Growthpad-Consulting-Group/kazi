import Link from "next/link";
import { Icon } from "@iconify/react";
import type { TeamWeekTrend } from "../team-trend";

function weekLabel(weekStart: string) {
  return new Date(`${weekStart}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export default function TeamTrendStrip({ trend }: { trend: TeamWeekTrend[] }) {
  return (
    <section
      aria-labelledby="team-trend-heading"
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
              <Icon icon="solar:graph-up-broken" className="h-3.5 w-3.5" />
            </span>
            <h2
              id="team-trend-heading"
              className="text-sm font-semibold text-[var(--text-hi)]"
            >
              Team rhythm
            </h2>
          </div>
          <p className="mt-2 text-xs text-[var(--text-lo)]">
            Team-level check-in coverage, blockers, recognition and open
            follow-through over eight weeks. This is not a performance score for
            individuals.
          </p>
        </div>
        <Link
          href="/pulse/checkins?tab=team"
          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-500 hover:text-brand-600"
        >
          Open team check-ins
          <Icon icon="solar:arrow-right-broken" className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {trend.map((week) => (
          <div
            key={week.weekStart}
            className="flex flex-col items-center gap-2 rounded-xl bg-[var(--surface-2)] p-2"
            title={`Week of ${weekLabel(week.weekStart)}`}
          >
            <span className="font-mono text-xs font-bold text-[var(--text-hi)]">
              {week.coverage}%
            </span>
            <div className="flex h-16 w-full items-end overflow-hidden rounded-md bg-[var(--surface)]">
              <div
                className="w-full rounded-t-sm bg-brand-500/80"
                style={{
                  height: `${Math.max(week.coverage ? 6 : 0, week.coverage)}%`,
                }}
              />
            </div>
            <span className="text-[10px] text-[var(--text-lo)]">
              {week.blockers} blocker{week.blockers === 1 ? "" : "s"}
            </span>
            <span className="text-[10px] text-[var(--text-lo)]">
              {week.averageMood === null
                ? "No mood"
                : `Mood ${week.averageMood}`}
            </span>
            <span className="text-[10px] text-[var(--text-lo)]">
              {week.recognitions} kudos · {week.openActions} open
            </span>
            <span className="text-[10px] font-medium text-[var(--text-lo)]">
              {weekLabel(week.weekStart)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
