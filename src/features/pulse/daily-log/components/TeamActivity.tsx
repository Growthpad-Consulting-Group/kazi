"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import DateRangePicker, { computePresetRange, type DateRangeValue } from "@/components/ui/DateRangePicker";
import { Avatar } from "@/components/ui/Avatar";
import StatCard from "@/components/ui/StatCard";
import { DAILY_LOG_CATEGORIES, type DailyLogCategory, type DailyLogEntry } from "../constants";

type TeamEntry = DailyLogEntry & { date: string };
type TeamDay = { date: string; mood: number | null; blockers: string | null; wins: string | null };
type TeamMember = {
  days: TeamDay[];
  userId: string;
  name: string;
  jobTitle: string | null;
  avatarUrl: string | null;
  daysLogged: number;
  totalMinutes: number;
  byCategory: Record<string, number>;
  entries: TeamEntry[];
};

const RANGE_OPTIONS = ["This Week", "Last Week", "This Month", "Last Month", "Custom Range"];

function toDateString(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function formatMinutes(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours && minutes ? `${hours}h ${minutes}m` : hours ? `${hours}h` : `${minutes}m`;
}

function formatDay(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

const CATEGORY_COLORS: Record<DailyLogCategory, string> = {
  Projects: "bg-stone-700 dark:bg-stone-300",
  Meetings: "bg-brand-500/45",
  Hiring: "bg-rose-400",
  Reporting: "bg-slate-400",
  Admin: "bg-stone-300",
  Other: "bg-zinc-300",
};

export function TeamActivity() {
  const [range, setRange] = useState<DateRangeValue>(() => ({ ...computePresetRange("This Week"), label: "This Week" }));
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);

  const from = range.startDate ? toDateString(range.startDate) : null;
  const to = range.endDate ? toDateString(range.endDate) : null;

  useEffect(() => {
    if (!from || !to) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/pulse/daily-log?scope=team&from=${from}&to=${to}`)
      .then((res) => res.json())
      .then((json: { team?: TeamMember[]; error?: string }) => {
        if (cancelled) return;
        if (json.error) throw new Error(json.error);
        setTeam(json.team ?? []);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setTeam([]);
          setError(err.message);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [from, to]);

  const sortedTeam = useMemo(
    () => [...team].sort((a, b) => Number(b.daysLogged > 0) - Number(a.daysLogged > 0) || b.totalMinutes - a.totalMinutes || a.name.localeCompare(b.name)),
    [team]
  );
  const summary = useMemo(() => ({
    members: team.length,
    withLogs: team.filter((member) => member.daysLogged > 0).length,
    minutes: team.reduce((sum, member) => sum + member.totalMinutes, 0),
  }), [team]);

  const toggle = (userId: string) => setExpanded((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 transition-shadow duration-200 hover:shadow-2xl dark:shadow-black/20 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500"><Icon icon="solar:users-group-two-rounded-broken" className="h-5 w-5" /></span>
            <div>
              <h2 className="text-base font-semibold text-[var(--text-hi)]">Team activity</h2>
              <p className="mt-0.5 text-xs text-[var(--text-lo)]">How each person spent their time across the selected range.</p>
            </div>
          </div>
          <div className="w-full sm:w-72">
            <DateRangePicker value={range} onChange={setRange} allowedRanges={RANGE_OPTIONS} maxDate={null} fullWidth />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard title="Team members" value={summary.members} icon="solar:users-group-two-rounded-broken" color="slate" variant="inline" compact />
          <StatCard title="Logged anything" value={summary.withLogs} icon="solar:check-circle-broken" color="green" variant="inline" compact />
          <StatCard title="Total time" value={formatMinutes(summary.minutes)} icon="solar:stopwatch-broken" color="orange" variant="inline" compact />
        </div>
      </div>

      {error && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="px-1 text-sm text-[var(--text-lo)]">Loading team activity…</p>
      ) : sortedTeam.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center shadow-xl shadow-slate-200/50 dark:shadow-black/20">
          <p className="text-sm font-semibold text-[var(--text-hi)]">No team members to show</p>
          <p className="mt-1 text-xs text-[var(--text-lo)]">Team activity appears here once people are assigned to you.</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {sortedTeam.map((member) => {
            const isOpen = expanded.includes(member.userId);
            const total = member.totalMinutes || 1;
            const categories = DAILY_LOG_CATEGORIES.filter((category) => member.byCategory[category]);
            return (
              <article key={member.userId} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 transition-shadow duration-200 hover:shadow-2xl dark:shadow-black/20">
                <div className="flex items-start gap-3">
                  <Avatar name={member.name} src={member.avatarUrl} size="md" className={member.daysLogged ? "" : "bg-[var(--surface-2)] text-[var(--text-lo)]"} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--text-hi)]">{member.name}</p>
                        <p className="mt-0.5 text-[11px] text-[var(--text-lo)]">{member.jobTitle ?? "Team member"}</p>
                      </div>
                      {member.daysLogged ? (
                        <span className="shrink-0 rounded-lg bg-brand-500/10 px-2.5 py-1 font-mono text-xs font-semibold text-brand-500">{formatMinutes(member.totalMinutes)}</span>
                      ) : (
                        <span className="shrink-0 rounded-lg bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700">Nothing logged</span>
                      )}
                    </div>

                    {member.daysLogged > 0 && (
                      <div className="mt-4 space-y-2">
                        <div className="flex h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                          {categories.map((category) => (
                            <span key={category} className={CATEGORY_COLORS[category]} style={{ width: `${(member.byCategory[category] / total) * 100}%` }} title={`${category}: ${formatMinutes(member.byCategory[category])}`} />
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--text-lo)]">
                          {categories.map((category) => (
                            <span key={category} className="inline-flex items-center gap-1.5">
                              <span className={`h-2 w-2 rounded-full ${CATEGORY_COLORS[category]}`} />
                              {category} · <span className="font-mono">{formatMinutes(member.byCategory[category])}</span>
                            </span>
                          ))}
                        </div>
                        <p className="text-[11px] text-[var(--text-lo)]">Logged on {member.daysLogged} day{member.daysLogged === 1 ? "" : "s"}</p>
                      </div>
                    )}

                    {member.entries.length > 0 && (
                      <button type="button" onClick={() => toggle(member.userId)} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-500 hover:underline">
                        <Icon icon={isOpen ? "solar:alt-arrow-up-broken" : "solar:alt-arrow-down-broken"} className="h-3.5 w-3.5" />
                        {isOpen ? "Hide entries" : `Show ${member.entries.length} entr${member.entries.length === 1 ? "y" : "ies"}`}
                      </button>
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-4 space-y-4 border-t border-[var(--border)] pt-4">
                    {groupByDate(member.entries, member.days).map(([date, dayEntries]) => (
                      <div key={date}>
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-lo)]">{formatDay(date)} · {formatMinutes(dayEntries.reduce((sum, entry) => sum + entry.minutes, 0))}</p>
                        {(() => { const day = member.days.find((d) => d.date === date); return day && (day.mood || day.blockers || day.wins) ? (
                          <div className="mb-2 space-y-1 rounded-lg bg-brand-500/5 px-3 py-2 text-xs text-[var(--text-hi)]">
                            {day.mood ? <p>Mood {moodEmoji(day.mood)}</p> : null}
                            {day.blockers ? <p><span className="font-semibold">Blockers:</span> {day.blockers}</p> : null}
                            {day.wins ? <p><span className="font-semibold">Wins:</span> {day.wins}</p> : null}
                          </div>
                        ) : null; })()}
                        <ul className="space-y-1.5">
                          {dayEntries.map((entry, index) => (
                            <li key={index} className="flex flex-col gap-1 rounded-lg bg-[var(--surface-2)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                              <span className="min-w-0 truncate text-xs font-medium text-[var(--text-hi)]">{entry.task}</span>
                              <span className="flex shrink-0 flex-wrap items-center gap-2 text-[11px] text-[var(--text-lo)]">
                                {entry.client && <span className="rounded-md bg-[var(--surface)] px-1.5 py-0.5">{entry.client}</span>}
                                <span className="rounded-md bg-[var(--surface)] px-1.5 py-0.5">{entry.category}</span>
                                <span className="font-mono">{entry.startTime && entry.endTime ? `${entry.startTime}–${entry.endTime} · ` : ""}{formatMinutes(entry.minutes)}</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function groupByDate(entries: TeamEntry[], days: TeamDay[]) {
  const groups = new Map<string, TeamEntry[]>();
  for (const day of days) if (day.blockers || day.mood || day.wins) groups.set(day.date, groups.get(day.date) ?? []);
  for (const entry of entries) groups.set(entry.date, [...(groups.get(entry.date) ?? []), entry]);
  return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
}

function moodEmoji(mood: number | null | undefined) {
  return ["", "😔", "😕", "😐", "🙂", "😄"][mood ?? 0] ?? "";
}

