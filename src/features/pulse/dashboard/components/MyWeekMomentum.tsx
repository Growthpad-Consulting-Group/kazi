import Link from "next/link";
import { Icon } from "@iconify/react";
import { WORKDAYS_PER_WEEK, type MyWeekSummary } from "../my-week";

// Mirrors formatMinutes in daily-log/components/DailyLogRecap (a client module,
// so it cannot be called from this server component).
function formatDuration(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours && minutes
    ? `${hours}h ${minutes}m`
    : hours
      ? `${hours}h`
      : `${minutes}m`;
}

type Tile = {
  label: string;
  value: string;
  hint: string;
  icon: string;
  href: string;
};

export default function MyWeekMomentum({
  summary,
}: {
  summary: MyWeekSummary;
}) {
  const tiles: Tile[] = [
    {
      label: "Workdays logged",
      value: `${summary.workdaysLogged}/${WORKDAYS_PER_WEEK}`,
      hint:
        summary.workdaysLogged === WORKDAYS_PER_WEEK
          ? "Every workday covered"
          : "This week",
      icon: "solar:calendar-broken",
      href: "/pulse/checkins?tab=daily",
    },
    {
      label: "Tracked time",
      value: formatDuration(summary.trackedMinutes),
      hint: "Across this week",
      icon: "solar:clock-circle-broken",
      href: "/pulse/checkins?tab=daily",
    },
    {
      label: "Consistency",
      value: summary.streakDays
        ? `${summary.streakDays} day${summary.streakDays === 1 ? "" : "s"}`
        : "Start today",
      hint: "Logging streak",
      icon: "solar:fire-broken",
      href: "/pulse/checkins?tab=daily",
    },
    {
      label: "Goal progress",
      value: summary.goalProgress === null ? "—" : `${summary.goalProgress}%`,
      hint: summary.goalProgress === null ? "No active goals" : "Average",
      icon: "solar:target-broken",
      href: "/pulse/goals",
    },
    ...(summary.asanaCompleted === null
      ? []
      : [
          {
            label: "Asana tasks done",
            value: String(summary.asanaCompleted),
            hint: "Completed this week",
            icon: "solar:checklist-minimalistic-broken",
            href: "/pulse/checkins?tab=daily",
          },
        ]),
  ];

  return (
    <section
      aria-labelledby="my-week-heading"
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6"
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
          <Icon icon="solar:graph-up-broken" className="h-3.5 w-3.5" />
        </span>
        <h2
          id="my-week-heading"
          className="text-sm font-semibold text-[var(--text-hi)]"
        >
          My week
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            href={tile.href}
            className="group rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-500/60 hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[var(--text-lo)]">
                {tile.label}
              </span>
              <Icon
                icon={tile.icon}
                className="h-3.5 w-3.5 text-[var(--text-lo)]"
              />
            </div>
            <p className="mt-2 font-mono text-lg font-bold text-[var(--text-hi)]">
              {tile.value}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--text-lo)]">
              {tile.hint}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
