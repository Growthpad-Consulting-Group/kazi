import Link from "next/link";
import { Icon } from "@iconify/react";

function formatDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours && minutes
    ? `${hours}h ${minutes}m`
    : hours
      ? `${hours}h`
      : `${minutes}m`;
}

export default function TeamDailyActivityCard({
  activity,
}: {
  activity: {
    staffLogged: number;
    totalStaff: number;
    minutes: number;
    tasks: number;
  };
}) {
  const coverage = activity.totalStaff
    ? Math.round((activity.staffLogged / activity.totalStaff) * 100)
    : 0;
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20">
      <div className="flex items-start justify-between gap-4 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
            <Icon icon="solar:clock-circle-broken" className="h-5 w-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-[var(--text-hi)]">
                Daily activity
              </h2>
              <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-semibold text-brand-500">
                Today
              </span>
            </div>
            <p className="mt-1 text-xs text-[var(--text-lo)]">
              A live view of work logged today.
            </p>
          </div>
        </div>
        <Link
          href="/pulse/checkins?tab=daily"
          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-500 hover:text-brand-600"
        >
          View activity
          <Icon icon="solar:arrow-right-broken" className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="border-t border-[var(--border)] bg-[var(--surface-2)] p-4 sm:p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-3xl font-bold tracking-tight text-[var(--text-hi)]">
              {activity.staffLogged}
              <span className="text-base text-[var(--text-lo)]">
                /{activity.totalStaff}
              </span>
            </p>
            <p className="mt-1 text-xs text-[var(--text-lo)]">
              staff logged activity
            </p>
          </div>
          <span className="rounded-full bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-lo)]">
            {coverage}% today
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-orange-400"
            style={{ width: `${coverage}%` }}
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-[var(--surface)] p-3 shadow-sm">
            <p className="font-mono text-sm font-bold text-[var(--text-hi)]">
              {formatDuration(activity.minutes)}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--text-lo)]">
              logged time
            </p>
          </div>
          <div className="rounded-xl bg-[var(--surface)] p-3 shadow-sm">
            <p className="font-mono text-sm font-bold text-[var(--text-hi)]">
              {activity.tasks}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--text-lo)]">
              activities logged
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
