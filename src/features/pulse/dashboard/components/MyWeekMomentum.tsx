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
      {summary.asanaTaskHealth &&
        (summary.asanaTaskHealth.overdue.length > 0 ||
          summary.asanaTaskHealth.dueToday.length > 0) && (
          <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-[var(--text-hi)]">
                Asana task health
              </p>
              <span className="text-[11px] text-[var(--text-lo)]">
                Your assigned work
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {summary.asanaTaskHealth.overdue.length > 0 && (
                <TaskList
                  title={`${summary.asanaTaskHealth.overdue.length} overdue`}
                  tone="text-red-600 dark:text-red-400"
                  tasks={summary.asanaTaskHealth.overdue}
                />
              )}
              {summary.asanaTaskHealth.dueToday.length > 0 && (
                <TaskList
                  title={`${summary.asanaTaskHealth.dueToday.length} due today`}
                  tone="text-amber-600 dark:text-amber-400"
                  tasks={summary.asanaTaskHealth.dueToday}
                />
              )}
            </div>
          </div>
        )}
    </section>
  );
}

function TaskList({
  title,
  tone,
  tasks,
}: {
  title: string;
  tone: string;
  tasks: NonNullable<MyWeekSummary["asanaTaskHealth"]>["dueToday"];
}) {
  return (
    <div className="rounded-lg bg-[var(--surface)] p-2.5">
      <p className={`mb-1.5 text-[11px] font-semibold ${tone}`}>{title}</p>
      <div className="space-y-1.5">
        {tasks.slice(0, 3).map((task) => {
          const content = (
            <>
              <p className="truncate text-xs font-medium text-[var(--text-hi)]">
                {task.name}
              </p>
              {task.project && (
                <p className="truncate text-[11px] text-[var(--text-lo)]">
                  {task.project}
                </p>
              )}
            </>
          );
          return task.url ? (
            <a
              key={task.id}
              href={task.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-md px-1 py-0.5 transition-colors hover:bg-[var(--surface-2)]"
            >
              {content}
            </a>
          ) : (
            <div key={task.id} className="px-1 py-0.5">
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
