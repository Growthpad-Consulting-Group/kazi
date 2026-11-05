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

function trendLabel(current: number, previous: number | undefined) {
  if (previous === undefined) return "First tracked week";
  const delta = current - previous;
  if (delta === 0) return "Same as last week";
  return `${delta > 0 ? "+" : ""}${delta} pts from last week`;
}

export default function TeamTrendStrip({ trend }: { trend: TeamWeekTrend[] }) {
  const latest = trend.at(-1);
  const previous = trend.at(-2);
  if (!latest) return null;

  const currentMood =
    latest.averageMood === null ? "—" : `${latest.averageMood.toFixed(1)}/5`;

  return (
    <section
      aria-labelledby="team-trend-heading"
      className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
            <Icon icon="solar:graph-up-broken" className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-brand-500">
              Team pulse
            </p>
            <h2
              id="team-trend-heading"
              className="mt-0.5 text-base font-semibold text-[var(--text-hi)]"
            >
              Team rhythm
            </h2>
            <p className="mt-1 text-xs text-[var(--text-lo)]">
              Weekly team signals, not individual performance scores.
            </p>
          </div>
        </div>
        <Link
          href="/pulse/checkins?tab=team"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold text-[var(--text-hi)] transition-colors hover:bg-brand-500/10 hover:text-brand-600 dark:hover:text-brand-400"
        >
          Review team
          <Icon icon="solar:arrow-right-broken" className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid border-b border-[var(--border)] lg:grid-cols-[minmax(220px,0.72fr)_minmax(0,1.5fr)]">
        <div className="border-b border-[var(--border)] bg-[var(--surface-2)] p-5 lg:border-b-0 lg:border-r sm:p-6">
          <p className="text-xs font-medium text-[var(--text-lo)]">This week</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className="font-mono text-4xl font-bold tracking-tight text-[var(--text-hi)]">
              {latest.coverage}
              <span className="text-xl text-[var(--text-lo)]">%</span>
            </p>
            <span
              className={`mb-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${latest.coverage >= 80 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}
            >
              {trendLabel(latest.coverage, previous?.coverage)}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--border)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-orange-400 transition-[width] duration-500"
              style={{ width: `${latest.coverage}%` }}
            />
          </div>
          <p className="mt-3 text-[11px] text-[var(--text-lo)]">
            Check-in coverage for week of {weekLabel(latest.weekStart)}
          </p>
        </div>

        <div className="flex min-h-52 items-end gap-2 px-4 pb-5 pt-6 sm:gap-3 sm:px-6">
          {trend.map((week, index) => {
            const current = index === trend.length - 1;
            return (
              <div
                key={week.weekStart}
                className="group flex min-w-0 flex-1 flex-col items-center gap-2"
                title={`Week of ${weekLabel(week.weekStart)}: ${week.coverage}% check-in coverage, ${week.blockers} blockers, ${week.recognitions} kudos, ${week.openActions} open actions`}
              >
                <span
                  className={`font-mono text-[11px] font-bold ${current ? "text-brand-500" : "text-[var(--text-lo)]"}`}
                >
                  {week.coverage}%
                </span>
                <div className="flex h-28 w-full items-end rounded-lg bg-[var(--surface-2)] p-1">
                  <div
                    className={`w-full rounded-md transition-all duration-300 ${current ? "bg-gradient-to-t from-brand-500 to-orange-400 shadow-lg shadow-brand-500/20" : "bg-[var(--text-lo)]/30 group-hover:bg-brand-500/60"}`}
                    style={{
                      height: `${Math.max(week.coverage ? 8 : 0, week.coverage)}%`,
                    }}
                  />
                </div>
                <span
                  className={`whitespace-nowrap text-[10px] font-medium ${current ? "text-[var(--text-hi)]" : "text-[var(--text-lo)]"}`}
                >
                  {current ? "This week" : weekLabel(week.weekStart)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-[var(--border)]">
        <Signal
          icon="solar:heart-pulse-broken"
          label="Average mood"
          value={currentMood}
          tone="text-sky-600 dark:text-sky-400"
        />
        <Signal
          icon="solar:danger-triangle-broken"
          label="Blockers raised"
          value={String(latest.blockers)}
          tone={
            latest.blockers
              ? "text-amber-600 dark:text-amber-400"
              : "text-emerald-600 dark:text-emerald-400"
          }
        />
        <Signal
          icon="solar:chat-round-dots-broken"
          label="Open actions"
          value={String(latest.openActions)}
          tone="text-brand-500"
          suffix={
            latest.recognitions ? `${latest.recognitions} kudos` : undefined
          }
        />
      </div>
    </section>
  );
}

function Signal({
  icon,
  label,
  value,
  tone,
  suffix,
}: {
  icon: string;
  label: string;
  value: string;
  tone: string;
  suffix?: string;
}) {
  return (
    <div className="min-w-0 p-3 sm:flex sm:items-center sm:gap-2.5 sm:p-4">
      <Icon icon={icon} className={`h-4 w-4 shrink-0 ${tone}`} />
      <div className="mt-1 sm:mt-0">
        <p className="font-mono text-sm font-bold text-[var(--text-hi)]">
          {value}
          {suffix && (
            <span className="ml-1 font-sans text-[10px] font-medium text-[var(--text-lo)]">
              · {suffix}
            </span>
          )}
        </p>
        <p className="truncate text-[10px] text-[var(--text-lo)]">{label}</p>
      </div>
    </div>
  );
}
