"use client";

import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/Button";
import StatCard from "@/components/ui/StatCard";
import {
  DAILY_LOG_CATEGORIES,
  MOOD_LABELS,
  type DailyLogCategory,
  type DailyLogEntry,
} from "../constants";

export const MOODS = ["😔", "😕", "😐", "🙂", "😄"];

const CATEGORY_COLORS: Record<DailyLogCategory, string> = {
  Projects: "bg-stone-700 dark:bg-stone-300",
  Meetings: "bg-brand-500/45",
  Hiring: "bg-rose-400",
  Reporting: "bg-slate-400",
  Admin: "bg-stone-300",
  Other: "bg-zinc-300",
};

export function formatMinutes(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours && minutes
    ? `${hours}h ${minutes}m`
    : hours
      ? `${hours}h`
      : `${minutes}m`;
}

export function DailyLogRecap({
  dateLabel,
  entries,
  mood,
  moodNote,
  blockers,
  wins,
  updatedAt,
  edited,
  canEdit,
  onEdit,
  activeTimer,
  onOpenTimer,
}: {
  dateLabel: string;
  entries: DailyLogEntry[];
  mood: number | null;
  moodNote: string | null;
  blockers: string | null;
  wins: string | null;
  updatedAt: string | null;
  edited: boolean;
  canEdit: boolean;
  onEdit: () => void;
  activeTimer?: { task: string; elapsed: string } | null;
  onOpenTimer?: () => void;
}) {
  const total = entries.reduce((sum, entry) => sum + entry.minutes, 0);
  const categories = DAILY_LOG_CATEGORIES.filter((category) =>
    entries.some((entry) => entry.category === category),
  );

  return (
    <section className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 transition-shadow duration-200 hover:shadow-2xl dark:shadow-black/20 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-lo)]">
            Logged
          </p>
          <h2 className="mt-1 text-base font-semibold text-[var(--text-hi)]">
            {dateLabel}
          </h2>
          {updatedAt && (
            <p className="mt-0.5 text-[11px] text-[var(--text-lo)]">
              Saved{" "}
              {new Date(updatedAt).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}
              {edited ? " · edited after first save" : ""}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-stretch justify-end gap-3">
          {activeTimer && onOpenTimer && (
            <button
              type="button"
              onClick={onOpenTimer}
              className="group flex min-w-[13rem] items-center gap-2 rounded-xl bg-brand-500/10 px-3 py-2 text-left transition-colors hover:bg-brand-500/15"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white">
                <Icon icon="solar:stopwatch-broken" className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-brand-600">
                  Timer running
                </span>
                <span className="block truncate font-mono text-xs font-bold text-[var(--text-hi)]">
                  {activeTimer.elapsed} ·{" "}
                  {activeTimer.task || "Untitled activity"}
                </span>
              </span>
              <Icon
                icon="solar:alt-arrow-right-broken"
                className="ml-auto h-3.5 w-3.5 text-brand-500 transition-transform group-hover:translate-x-0.5"
              />
            </button>
          )}
          {canEdit ? (
            <div className="flex">
              <Button
                size="sm"
                variant="secondary"
                icon="solar:pen-broken"
                onClick={onEdit}
                className="self-stretch"
              >
                Edit
              </Button>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface-2)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-lo)]">
              <Icon icon="solar:lock-keyhole-broken" className="h-3.5 w-3.5" />{" "}
              Locked
            </span>
          )}
          <div className="min-w-[10rem]">
            <StatCard
              variant="inline"
              compact
              title="Logged"
              value={formatMinutes(total)}
              icon="solar:stopwatch-broken"
              color="orange"
              subtitle={`${entries.length} task${entries.length === 1 ? "" : "s"}`}
            />
          </div>
        </div>
      </div>

      {total > 0 && (
        <div className="space-y-2">
          <div className="flex h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
            {categories.map((category) => (
              <span
                key={category}
                className={CATEGORY_COLORS[category]}
                style={{
                  width: `${(entries.filter((entry) => entry.category === category).reduce((sum, entry) => sum + entry.minutes, 0) / total) * 100}%`,
                }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--text-lo)]">
            {categories.map((category) => (
              <span key={category} className="inline-flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${CATEGORY_COLORS[category]}`}
                />
                {category} ·{" "}
                <span className="font-mono">
                  {formatMinutes(
                    entries
                      .filter((entry) => entry.category === category)
                      .reduce((sum, entry) => sum + entry.minutes, 0),
                  )}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[var(--border)]">
        <div className="hidden gap-3 border-b border-[var(--border)] px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-lo)] sm:grid sm:grid-cols-[minmax(0,1fr)_6rem_5rem_11rem]">
          <span>Task</span>
          <span>Client</span>
          <span>Type</span>
          <span className="text-right">Time</span>
        </div>
        <ul className="divide-y divide-[var(--border)]">
          {entries.map((entry, index) => (
            <li
              key={index}
              className="grid gap-1 px-4 py-3 transition-colors hover:bg-brand-500/[0.06] sm:grid-cols-[minmax(0,1fr)_6rem_5rem_11rem] sm:items-center sm:gap-3"
            >
              <span className="min-w-0 truncate text-sm text-[var(--text-hi)]">
                {entry.task}
              </span>
              <span className="min-w-0 truncate text-xs text-[var(--text-lo)]">
                {entry.client || "—"}
              </span>
              <span className="min-w-0 truncate text-xs text-[var(--text-lo)]">
                {entry.category}
              </span>
              <span className="text-[11px] font-mono text-[var(--text-lo)] sm:text-right">
                {entry.startTime && entry.endTime
                  ? `${entry.startTime}–${entry.endTime} · `
                  : ""}
                {formatMinutes(entry.minutes)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {(mood || moodNote || blockers || wins) && (
        <div className="grid gap-3 sm:grid-cols-3">
          {mood ? (
            <div className="rounded-xl bg-[var(--surface-2)] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-lo)]">
                Feeling
              </p>
              <p
                title={MOOD_LABELS[mood - 1]}
                className="mt-1 cursor-help text-2xl"
              >
                {MOODS[mood - 1]}
              </p>
            </div>
          ) : null}
          {moodNote ? (
            <div className="rounded-xl bg-amber-500/[0.06] p-3 sm:col-span-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                Support note
              </p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-[var(--text-hi)]">
                {moodNote}
              </p>
            </div>
          ) : null}
          {blockers ? (
            <div className="rounded-xl bg-[var(--surface-2)] p-3 sm:col-span-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-lo)]">
                Blockers
              </p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-[var(--text-hi)]">
                {blockers}
              </p>
            </div>
          ) : null}
          {wins ? (
            <div className="rounded-xl bg-[var(--surface-2)] p-3 sm:col-span-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-lo)]">
                Wins and learnings
              </p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-[var(--text-hi)]">
                {wins}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

export function DailyLogHistory({
  logs,
  selected,
  onSelect,
}: {
  logs: { date: string; entries: DailyLogEntry[]; mood: number | null }[];
  selected: string;
  onSelect: (date: string) => void;
}) {
  const orderedLogs = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const loggedDays = orderedLogs.filter((log) => log.entries.length > 0);
  const totalMinutes = orderedLogs.reduce(
    (total, log) =>
      total + log.entries.reduce((sum, entry) => sum + entry.minutes, 0),
    0,
  );
  return (
    <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 dark:shadow-black/20 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--text-lo)]">
          This workweek
        </p>
        <span className="rounded-full bg-brand-500/[0.08] px-2.5 py-1 text-[10px] font-semibold text-brand-600 dark:text-brand-300">
          {loggedDays.length}/5 days logged
        </span>
      </div>
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_15rem]">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {orderedLogs.map((log) => {
            const total = log.entries.reduce(
              (sum, entry) => sum + entry.minutes,
              0,
            );
            const active = log.date === selected;
            return (
              <li key={log.date}>
                <div
                  className={`rounded-2xl transition-shadow ${active ? "ring-2 ring-brand-500/50" : ""}`}
                >
                  <StatCard
                    variant="inline"
                    compact
                    title={new Date(`${log.date}T12:00:00`).toLocaleDateString(
                      "en-GB",
                      {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      },
                    )}
                    value={total ? formatMinutes(total) : "—"}
                    subtitle={
                      log.mood
                        ? `${MOODS[log.mood - 1]} ${MOOD_LABELS[log.mood - 1]}`
                        : log.entries.length
                          ? "Logged"
                          : "Not logged"
                    }
                    icon="solar:calendar-broken"
                    color="orange"
                    inlineStacked
                    onClick={() => onSelect(log.date)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-3 rounded-2xl border border-brand-500/15 bg-brand-500/[0.045] px-4 py-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
            <Icon icon="solar:chart-square-broken" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-lo)]">
              Week total
            </p>
            <p className="mt-0.5 text-lg font-bold text-[var(--text-hi)]">
              {formatMinutes(totalMinutes)}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--text-lo)]">
              {loggedDays.length === 5
                ? "All workdays logged"
                : `${5 - loggedDays.length} workday${5 - loggedDays.length === 1 ? "" : "s"} remaining`}
            </p>
          </div>
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-[11px] text-[var(--text-lo)]">
        <Icon icon="solar:info-circle-broken" className="h-3.5 w-3.5" /> Days
        without a log show a dash.
      </p>
    </section>
  );
}
