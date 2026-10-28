"use client";

import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/Button";
import StatCard from "@/components/ui/StatCard";
import { DAILY_LOG_CATEGORIES, MOOD_LABELS, type DailyLogCategory, type DailyLogEntry } from "../constants";

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
  return hours && minutes ? `${hours}h ${minutes}m` : hours ? `${hours}h` : `${minutes}m`;
}

export function DailyLogRecap({
  dateLabel,
  entries,
  mood,
  blockers,
  wins,
  updatedAt,
  edited,
  canEdit,
  onEdit,
}: {
  dateLabel: string;
  entries: DailyLogEntry[];
  mood: number | null;
  blockers: string | null;
  wins: string | null;
  updatedAt: string | null;
  edited: boolean;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const total = entries.reduce((sum, entry) => sum + entry.minutes, 0);
  const categories = DAILY_LOG_CATEGORIES.filter((category) => entries.some((entry) => entry.category === category));

  return (
    <section className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 transition-shadow duration-200 hover:shadow-2xl dark:shadow-black/20 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-lo)]">Logged</p>
          <h2 className="mt-1 text-base font-semibold text-[var(--text-hi)]">{dateLabel}</h2>
          {updatedAt && (
            <p className="mt-0.5 text-[11px] text-[var(--text-lo)]">
              Saved {new Date(updatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}{edited ? " · edited after first save" : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="min-w-[10rem]">
            <StatCard variant="inline" compact title="Logged" value={formatMinutes(total)} icon="solar:stopwatch-broken" color="orange" subtitle={`${entries.length} task${entries.length === 1 ? "" : "s"}`} />
          </div>
          {canEdit ? (
            <Button size="sm" variant="secondary" icon="solar:pen-broken" onClick={onEdit}>Edit</Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface-2)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-lo)]">
              <Icon icon="solar:lock-keyhole-broken" className="h-3.5 w-3.5" /> Locked
            </span>
          )}
        </div>
      </div>

      {total > 0 && (
        <div className="space-y-2">
          <div className="flex h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
            {categories.map((category) => (
              <span
                key={category}
                className={CATEGORY_COLORS[category]}
                style={{ width: `${(entries.filter((entry) => entry.category === category).reduce((sum, entry) => sum + entry.minutes, 0) / total) * 100}%` }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--text-lo)]">
            {categories.map((category) => (
              <span key={category} className="inline-flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${CATEGORY_COLORS[category]}`} />
                {category} · <span className="font-mono">{formatMinutes(entries.filter((entry) => entry.category === category).reduce((sum, entry) => sum + entry.minutes, 0))}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
        {entries.map((entry, index) => (
          <li key={index} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <span className="min-w-0 truncate text-sm text-[var(--text-hi)]">
              {entry.task}
              {entry.client && <span className="ml-2 rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] text-[var(--text-lo)]">{entry.client}</span>}
            </span>
            <span className="flex shrink-0 items-center gap-2 text-[11px] text-[var(--text-lo)]">
              <span className="rounded-md bg-[var(--surface-2)] px-1.5 py-0.5">{entry.category}</span>
              <span className="font-mono">{entry.startTime && entry.endTime ? `${entry.startTime}–${entry.endTime} · ` : ""}{formatMinutes(entry.minutes)}</span>
            </span>
          </li>
        ))}
      </ul>

      {(mood || blockers || wins) && (
        <div className="grid gap-3 sm:grid-cols-3">
          {mood ? (
            <div className="rounded-xl bg-[var(--surface-2)] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-lo)]">Feeling</p>
              <p title={MOOD_LABELS[mood - 1]} className="mt-1 inline-block cursor-help text-2xl transition-transform duration-150 hover:scale-110">{MOODS[mood - 1]}</p>
            </div>
          ) : null}
          {blockers ? (
            <div className="rounded-xl bg-[var(--surface-2)] p-3 sm:col-span-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-lo)]">Blockers</p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-[var(--text-hi)]">{blockers}</p>
            </div>
          ) : null}
          {wins ? (
            <div className="rounded-xl bg-[var(--surface-2)] p-3 sm:col-span-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-lo)]">Wins and learnings</p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-[var(--text-hi)]">{wins}</p>
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
  return (
    <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 dark:shadow-black/20 sm:p-6">
      <p className="text-sm font-semibold text-[var(--text-lo)]">Last 7 days</p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
        {logs.map((log) => {
          const total = log.entries.reduce((sum, entry) => sum + entry.minutes, 0);
          const active = log.date === selected;
          return (
            <li key={log.date}>
              <div className={`rounded-2xl transition-shadow ${active ? "ring-2 ring-brand-500/50" : ""}`}>
                <StatCard
                  variant="inline"
                  compact
                  title={new Date(`${log.date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                  value={total ? formatMinutes(total) : "—"}
                  subtitle={log.mood ? MOODS[log.mood - 1] : log.entries.length ? "Logged" : "Not logged"}
                  icon="solar:calendar-broken"
                  color="orange"
                  onClick={() => onSelect(log.date)}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="flex items-center gap-1.5 text-[11px] text-[var(--text-lo)]">
        <Icon icon="solar:info-circle-broken" className="h-3.5 w-3.5" /> Days without a log show a dash.
      </p>
    </section>
  );
}
