import Link from "next/link";
import { Icon } from "@iconify/react";
import { WORKDAYS_PER_WEEK, type MyWeekSummary } from "../my-week";

function formatDuration(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours && minutes
    ? `${hours}h ${minutes}m`
    : hours
      ? `${hours}h`
      : `${minutes}m`;
}

type Metric = {
  label: string;
  value: string;
  icon: string;
  href: string;
  tone: string;
};

export default function MyWeekMomentum({
  summary,
}: {
  summary: MyWeekSummary;
}) {
  const hasAsanaAttention =
    summary.asanaTaskHealth &&
    (summary.asanaTaskHealth.overdue.length > 0 ||
      summary.asanaTaskHealth.dueToday.length > 0 ||
      summary.asanaTaskHealth.blocked.length > 0);
  const metrics: Metric[] = [
    {
      label: "Tracked",
      value: formatDuration(summary.trackedMinutes),
      icon: "solar:clock-circle-broken",
      href: "/pulse/checkins?tab=daily",
      tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    },
    {
      label: "Logging streak",
      value: summary.streakDays
        ? `${summary.streakDays} day${summary.streakDays === 1 ? "" : "s"}`
        : "Start today",
      icon: "solar:fire-broken",
      href: "/pulse/checkins?tab=daily",
      tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    {
      label: "Goal progress",
      value: summary.goalProgress === null ? "—" : `${summary.goalProgress}%`,
      icon: "solar:target-broken",
      href: "/pulse/goals",
      tone: "bg-brand-500/10 text-brand-500",
    },
    ...(summary.asanaCompleted === null
      ? []
      : [
          {
            label: "Asana completed",
            value: String(summary.asanaCompleted),
            icon: "solar:checklist-minimalistic-broken",
            href: "/pulse/checkins?tab=daily",
            tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
          },
        ]),
  ];

  return (
    <section
      aria-labelledby="my-week-heading"
      className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20"
    >
      <div className="grid border-b border-[var(--border)] lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.58fr)]">
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                <Icon icon="solar:graph-up-broken" className="h-3.5 w-3.5" />
              </span>
              <div>
                <h2
                  id="my-week-heading"
                  className="text-sm font-semibold text-[var(--text-hi)]"
                >
                  My week
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-lo)]">
                  Your work rhythm at a glance
                </p>
              </div>
            </div>
            <Link
              href="/pulse/checkins?tab=daily"
              className="text-xs font-semibold text-brand-500 transition-colors hover:text-brand-600"
            >
              Open log
            </Link>
          </div>

          <Link
            href="/pulse/checkins?tab=daily"
            className="group mt-5 block rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 transition-all hover:border-brand-500/40 hover:shadow-md"
          >
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-[var(--text-lo)]">
                  Workdays logged
                </p>
                <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-[var(--text-hi)]">
                  {summary.workdaysLogged}
                  <span className="text-base text-[var(--text-lo)]">
                    /{WORKDAYS_PER_WEEK}
                  </span>
                </p>
              </div>
              <span className="rounded-full bg-brand-500/10 px-2.5 py-1 text-[11px] font-semibold text-brand-600 dark:text-brand-400">
                {summary.workdaysLogged === WORKDAYS_PER_WEEK
                  ? "Week complete"
                  : `${WORKDAYS_PER_WEEK - summary.workdaysLogged} to go`}
              </span>
            </div>
            <div className="mt-3 flex gap-1.5" aria-hidden="true">
              {Array.from({ length: WORKDAYS_PER_WEEK }, (_, index) => (
                <span
                  key={index}
                  className={`h-1.5 flex-1 rounded-full ${index < summary.workdaysLogged ? "bg-gradient-to-r from-brand-500 to-orange-400" : "bg-[var(--border)]"}`}
                />
              ))}
            </div>
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-px bg-[var(--border)]">
          {metrics.map((metric) => (
            <Link
              key={metric.label}
              href={metric.href}
              className="group flex min-h-[116px] flex-col justify-between bg-[var(--surface)] p-4 transition-colors hover:bg-[var(--surface-2)] sm:p-5"
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${metric.tone}`}
              >
                <Icon icon={metric.icon} className="h-4 w-4" />
              </span>
              <div className="mt-3">
                <p className="font-mono text-lg font-bold tracking-tight text-[var(--text-hi)]">
                  {metric.value}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-[var(--text-lo)]">
                  {metric.label}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {hasAsanaAttention && summary.asanaTaskHealth && (
        <div className="bg-[var(--surface-2)] p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                <Icon
                  icon="solar:calendar-mark-broken"
                  className="h-3.5 w-3.5"
                />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-hi)]">
                  Asana task health
                </h3>
                <p className="text-xs text-[var(--text-lo)]">
                  Assigned work that needs attention
                </p>
              </div>
            </div>
            <a
              href="https://app.asana.com"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-brand-500 hover:text-brand-600"
            >
              Open Asana
            </a>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {summary.asanaTaskHealth.overdue.length > 0 && (
              <TaskList
                title="Overdue"
                count={summary.asanaTaskHealth.overdue.length}
                tone="text-red-600 dark:text-red-400"
                tasks={summary.asanaTaskHealth.overdue}
              />
            )}
            {summary.asanaTaskHealth.dueToday.length > 0 && (
              <TaskList
                title="Due today"
                count={summary.asanaTaskHealth.dueToday.length}
                tone="text-amber-600 dark:text-amber-400"
                tasks={summary.asanaTaskHealth.dueToday}
              />
            )}
            {summary.asanaTaskHealth.blocked.length > 0 && (
              <TaskList
                title="Blocked by other work"
                count={summary.asanaTaskHealth.blocked.length}
                tone="text-[var(--text-lo)]"
                tasks={summary.asanaTaskHealth.blocked}
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
  count,
  tone,
  tasks,
}: {
  title: string;
  count: number;
  tone: string;
  tasks: NonNullable<MyWeekSummary["asanaTaskHealth"]>["dueToday"];
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className={`text-xs font-semibold ${tone}`}>{title}</p>
        <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--text-lo)]">
          {count}
        </span>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {tasks.slice(0, 3).map((task) => {
          const content = (
            <>
              <p className="truncate text-xs font-medium text-[var(--text-hi)]">
                {task.name}
              </p>
              {task.project && (
                <p className="mt-0.5 truncate text-[11px] text-[var(--text-lo)]">
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
              className="group block py-2 first:pt-0 last:pb-0"
            >
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1">{content}</span>
                <Icon
                  icon="solar:arrow-right-up-broken"
                  className="h-3.5 w-3.5 shrink-0 text-[var(--text-lo)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />
              </span>
            </a>
          ) : (
            <div key={task.id} className="py-2 first:pt-0 last:pb-0">
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
