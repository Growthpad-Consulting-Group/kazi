"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { Accordion } from "@/components/ui/Accordion";
import DateRangePicker, { computePresetRange, type DateRangeValue } from "@/components/ui/DateRangePicker";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";
import StatCard from "@/components/ui/StatCard";
import { DAILY_LOG_CATEGORIES, MOOD_LABELS, type DailyLogCategory, type DailyLogEntry } from "../constants";

type TeamEntry = DailyLogEntry & { date: string };
type TeamDay = { date: string; mood: number | null; blockers: string | null; wins: string | null; hasEntries: boolean; acknowledged: boolean };
type TeamComment = { id: string; date: string; body: string; authorName: string | null; createdAt: string };
type TeamMember = {
  days: TeamDay[];
  userId: string;
  name: string;
  jobTitle: string | null;
  avatarUrl: string | null;
  daysLogged: number;
  totalMinutes: number;
  pointsEarned: number;
  comments: TeamComment[];
  byCategory: Record<string, number>;
  entries: TeamEntry[];
};

const RANGE_OPTIONS = ["This Week", "Last Week", "This Month", "Last Month", "Custom Range"];
type ActivityFilter = "all" | "logged" | "missing" | "attention";

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
  const [reloadKey, setReloadKey] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const todayIso = toDateString(new Date());

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
  }, [from, to, reloadKey]);

  const runAction = async (userId: string, action: "acknowledge" | "nudge" | "blocker", date: string) => {
    try {
      const res = await fetch("/api/pulse/daily-log/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userId, date }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; added?: boolean };
      if (!res.ok) throw new Error(json.error ?? "Could not do that.");
      if (action === "acknowledge") toast.success("Marked as read");
      else if (action === "nudge") toast.success("Reminder sent");
      else toast.success(json.added === false ? "Already in their next 1-on-1 agenda" : "Added to their next 1-on-1 agenda");
      setReloadKey((key) => key + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not do that.");
    }
  };

  const addNote = async (userId: string, date: string) => {
    const key = `${userId}|${date}`;
    const body = (drafts[key] ?? "").trim();
    if (!body) return;
    try {
      const res = await fetch("/api/pulse/daily-log/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, date, body }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not save the note.");
      setDrafts((prev) => ({ ...prev, [key]: "" }));
      toast.success("Note saved");
      setReloadKey((key) => key + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the note.");
    }
  };

  const needsSupport = (member: TeamMember) => member.days.some((day) => Boolean(day.blockers) || (day.mood ?? 5) <= 2);
  const sortedTeam = useMemo(() => {
    const matches = (member: TeamMember) => {
      if (filter === "logged") return member.daysLogged > 0;
      if (filter === "missing") return member.daysLogged === 0;
      if (filter === "attention") return needsSupport(member);
      return true;
    };
    return team
      .filter(matches)
      .sort((a, b) => Number(needsSupport(b)) - Number(needsSupport(a)) || Number(b.daysLogged > 0) - Number(a.daysLogged > 0) || b.totalMinutes - a.totalMinutes || a.name.localeCompare(b.name));
  }, [filter, team]);
  const summary = useMemo(() => ({
    members: team.length,
    withLogs: team.filter((member) => member.daysLogged > 0).length,
    needsSupport: team.filter(needsSupport).length,
  }), [team]);


  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 transition-shadow duration-200 hover:shadow-2xl dark:shadow-black/20 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500"><Icon icon="solar:users-group-two-rounded-broken" className="h-5 w-5" /></span>
            <div>
              <h2 className="text-base font-semibold text-[var(--text-hi)]">Daily reporting</h2>
              <p className="mt-0.5 text-xs text-[var(--text-lo)]">See coverage first, then open the work and support context behind each update.</p>
            </div>
          </div>
          <div className="w-full sm:w-72">
            <DateRangePicker value={range} onChange={setRange} allowedRanges={RANGE_OPTIONS} maxDate={null} fullWidth />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Team members" value={summary.members} icon="solar:users-group-two-rounded-broken" color="slate" variant="inline" compact onClick={() => setFilter("all")} />
          <StatCard title={summary.withLogs === 1 ? "Member logged" : "Members logged"} value={summary.withLogs} icon="solar:check-circle-broken" color="green" variant="inline" compact onClick={() => setFilter("logged")} />
          <StatCard title="No activity" value={summary.members - summary.withLogs} icon="solar:clock-circle-broken" color="amber" variant="inline" compact onClick={() => setFilter("missing")} />
          <StatCard title="Needs support" value={summary.needsSupport} icon="solar:heart-angle-broken" color="red" variant="inline" compact onClick={() => setFilter("attention")} />
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
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/45 p-3 shadow-xl shadow-slate-200/30 dark:shadow-black/10 sm:p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-hi)]">Team activity</h3>
              <p className="mt-0.5 text-xs text-[var(--text-lo)]">Open a day to review work, acknowledge it, or leave a manager note.</p>
            </div>
            <div className="flex flex-wrap gap-1 rounded-xl bg-[var(--surface)] p-1">
              {([
                ["all", "All"],
                ["logged", "Logged"],
                ["missing", "No activity"],
                ["attention", "Needs support"],
              ] as const).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${filter === value ? "bg-brand-500 text-white shadow-sm" : "text-[var(--text-lo)] hover:bg-[var(--surface-2)] hover:text-[var(--text-hi)]"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {sortedTeam.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center">
              <p className="text-sm font-semibold text-[var(--text-hi)]">No matching team activity</p>
              <p className="mt-1 text-xs text-[var(--text-lo)]">Try another filter or reporting range.</p>
            </div>
          ) : <div className="grid gap-4 xl:grid-cols-2">
          {sortedTeam.map((member) => {
            const total = member.totalMinutes || 1;
            const categories = DAILY_LOG_CATEGORIES.filter((category) => member.byCategory[category]);
            const attentionNeeded = needsSupport(member);
            return (
              <article key={member.userId} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl dark:shadow-black/20">
                <div className="flex items-start gap-3">
                  <Avatar name={member.name} src={member.avatarUrl} size="md" className={member.daysLogged ? "" : "bg-[var(--surface-2)] text-[var(--text-lo)]"} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--text-hi)]">{member.name}</p>
                        <p className="mt-0.5 text-[11px] text-[var(--text-lo)]">{member.jobTitle ?? "Team member"}</p>
                      </div>
                      {attentionNeeded ? (
                        <span className="shrink-0 rounded-lg bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-600 dark:text-red-400">Needs support</span>
                      ) : member.daysLogged ? (
                        <span className="shrink-0 rounded-lg bg-brand-500/10 px-2.5 py-1 font-mono text-xs font-semibold text-brand-500">{formatMinutes(member.totalMinutes)}</span>
                      ) : (
                        <span className="shrink-0 rounded-lg bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700">Nothing logged</span>
                      )}
                      {member.pointsEarned > 0 && (
                        <span className="shrink-0 rounded-lg bg-amber-500/10 px-2.5 py-1 font-mono text-xs font-semibold text-amber-600">+{member.pointsEarned} pts</span>
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
                        {from && to && from <= todayIso && todayIso <= to && !member.days.some((d) => d.date === todayIso && d.hasEntries) && (
                          <Button size="sm" variant="secondary" icon="solar:bell-ringing-broken" className="mt-2" onClick={() => runAction(member.userId, "nudge", todayIso)}>
                            Nudge to log today
                          </Button>
                        )}
                      </div>
                    )}

                  </div>
                </div>

                {member.entries.length > 0 && (
                  <div className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
                    {groupByDate(member.entries, member.days).map(([date, dayEntries]) => (
                      <Accordion
                        key={date}
                        title={formatDay(date)}
                        badge={formatMinutes(dayEntries.reduce((sum, entry) => sum + entry.minutes, 0))}
                        defaultOpen={false}
                      >
                        {(() => { const day = member.days.find((d) => d.date === date); return day && (day.mood || day.blockers || day.wins) ? (
                          <div className="mb-2 space-y-1 rounded-lg bg-brand-500/5 px-3 py-2 text-xs text-[var(--text-hi)]">
                            {day.mood ? <p>Mood <span title={MOOD_LABELS[day.mood - 1]} className="cursor-help">{moodEmoji(day.mood)}</span> <span className="text-[var(--text-lo)]">{MOOD_LABELS[day.mood - 1]}</span></p> : null}
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
                        <div className="mt-3 flex flex-wrap gap-2">
                          {member.days.find((d) => d.date === date)?.hasEntries && !member.days.find((d) => d.date === date)?.acknowledged && (
                            <Button size="sm" variant="secondary" icon="solar:check-circle-broken" onClick={() => runAction(member.userId, "acknowledge", date)}>Mark as read</Button>
                          )}
                          {member.days.find((d) => d.date === date)?.blockers && (
                            <Button size="sm" variant="secondary" icon="solar:calendar-add-broken" onClick={() => runAction(member.userId, "blocker", date)}>Add blocker to 1-on-1</Button>
                          )}
                        </div>
                        <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
                          <p className="text-xs font-semibold capitalize text-[var(--text-lo)]">Notes for the employee</p>
                          {member.comments.filter((c) => c.date === date).map((note) => (
                            <div key={note.id} className="rounded-lg bg-[var(--surface-2)] px-3 py-2 text-xs">
                              <p className="text-[var(--text-hi)]">{note.body}</p>
                              <p className="mt-1 text-[10px] text-[var(--text-lo)]">{note.authorName ?? "Manager"} · {new Date(note.createdAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</p>
                            </div>
                          ))}
                          <form
                            className="flex items-start gap-2"
                            onSubmit={(event) => {
                              event.preventDefault();
                              void addNote(member.userId, date);
                            }}
                          >
                            <textarea
                              value={drafts[`${member.userId}|${date}`] ?? ""}
                              onChange={(event) => setDrafts((prev) => ({ ...prev, [`${member.userId}|${date}`]: event.target.value }))}
                              maxLength={1000}
                              rows={2}
                              placeholder="Leave a note for them"
                              aria-label={`Note for ${member.name} on ${formatDay(date)}`}
                              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-hi)] outline-none focus:ring-2 focus:ring-brand-500/30"
                            />
                            <Button type="submit" size="sm">Send</Button>
                          </form>
                        </div>
                      </Accordion>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
          </div>}
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

