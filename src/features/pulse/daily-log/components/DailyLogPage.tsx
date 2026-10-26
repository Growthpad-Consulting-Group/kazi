"use client";

import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { DAILY_LOG_CATEGORIES, parseDurationMinutes, type DailyLogCategory, type DailyLogEntry } from "../constants";

type Row = { task: string; minutes: string; category: DailyLogCategory };
type TeamMember = { userId: string; name: string; jobTitle: string | null; entries: DailyLogEntry[]; totalMinutes: number; updatedAt: string | null };
type AsanaTask = { id: string; name: string; project: string | null };

const emptyRow = (): Row => ({ task: "", minutes: "", category: "Projects" });

function todayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatMinutes(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours && minutes ? `${hours}h ${minutes}m` : hours ? `${hours}h` : `${minutes}m`;
}

export function DailyLogPage({ showTeam }: { showTeam: boolean }) {
  const [date, setDate] = useState(todayLocal);
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [asana, setAsana] = useState<{ open: boolean; loading: boolean; connected: boolean; tasks: AsanaTask[]; selected: string[] }>({ open: false, loading: false, connected: false, tasks: [], selected: [] });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/pulse/daily-log?date=${date}`)
      .then((res) => res.json())
      .then((json: { entries?: DailyLogEntry[]; updatedAt?: string | null; error?: string }) => {
        if (cancelled) return;
        if (json.error) throw new Error(json.error);
        const loaded = json.entries ?? [];
        setRows(loaded.length ? loaded.map((entry) => ({ task: entry.task, minutes: formatMinutes(entry.minutes), category: entry.category })) : [emptyRow()]);
        setSavedAt(json.updatedAt ?? null);
      })
      .catch((err: Error) => !cancelled && toast.error(err.message))
      .finally(() => !cancelled && setLoading(false));

    if (showTeam) {
      fetch(`/api/pulse/daily-log?date=${date}&scope=team`)
        .then((res) => res.json())
        .then((json: { team?: TeamMember[]; error?: string }) => {
          if (!cancelled && json.team) setTeam(json.team);
        })
        .catch(() => !cancelled && setTeam([]));
    }
    return () => { cancelled = true; };
  }, [date, showTeam]);

  const totalMinutes = rows.reduce((sum, row) => sum + (parseDurationMinutes(row.minutes) ?? 0), 0);

  const updateRow = (index: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const openAsana = async () => {
    setAsana((prev) => ({ ...prev, open: true, loading: true, selected: [] }));
    try {
      const res = await fetch(`/api/pulse/checkins/asana-tasks?date=${date}`);
      const json = await res.json() as { connected?: boolean; tasks?: AsanaTask[]; error?: string };
      if (json.error) throw new Error(json.error);
      setAsana({ open: true, loading: false, connected: !!json.connected, tasks: json.tasks ?? [], selected: [] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load Asana tasks");
      setAsana((prev) => ({ ...prev, loading: false }));
    }
  };

  const addSelectedFromAsana = () => {
    const picked = asana.tasks.filter((task) => asana.selected.includes(task.id));
    setRows((prev) => {
      const base = prev.length === 1 && !prev[0].task && !prev[0].minutes ? [] : prev;
      return [...base, ...picked.map((task) => ({ task: task.project ? `${task.project}: ${task.name}` : task.name, minutes: "", category: "Projects" as DailyLogCategory }))];
    });
    setAsana((prev) => ({ ...prev, open: false }));
  };

  const save = async () => {
    const filled = rows.filter((row) => row.task.trim() || row.minutes.trim());
    if (!filled.length) {
      toast.error("Add at least one task");
      return;
    }
    const entries: DailyLogEntry[] = [];
    for (const row of filled) {
      const minutes = parseDurationMinutes(row.minutes);
      if (minutes === null) {
        toast.error(`Check the time for "${row.task || "a task"}". Try 45m, 1h, or 1h 30m.`);
        return;
      }
      entries.push({ task: row.task.trim(), minutes, category: row.category });
    }

    setSaving(true);
    try {
      const res = await fetch("/api/pulse/daily-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, entries }),
      });
      const json = await res.json().catch(() => null) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? "Could not save your log");
      setSavedAt(new Date().toISOString());
      toast.success("Daily log saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your log");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";

  return (
    <div className="space-y-6">
      <section className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/10"><Icon icon="solar:notebook-broken" className="h-3.5 w-3.5 text-brand-500" /></span>
            <div>
              <h2 className="text-base font-semibold text-[var(--text-hi)]">Daily activity log</h2>
              <p className="text-[11px] text-[var(--text-lo)]">What you worked on today and roughly how long it took.</p>
            </div>
          </div>
          <div className="w-48">
            <DatePicker value={date} onChange={setDate} maxDate={new Date()} />
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--text-lo)]">Loading…</p>
        ) : (
          <div className="space-y-3">
            {rows.map((row, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px_140px_auto]">
                <input value={row.task} onChange={(e) => updateRow(index, { task: e.target.value })} placeholder="What did you work on?" maxLength={200} className={inputClass} />
                <input value={row.minutes} onChange={(e) => updateRow(index, { minutes: e.target.value })} placeholder="e.g. 1h 30m" className={inputClass} />
                <select value={row.category} onChange={(e) => updateRow(index, { category: e.target.value as DailyLogCategory })} className={inputClass}>
                  {DAILY_LOG_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => setRows((prev) => (prev.length === 1 ? [emptyRow()] : prev.filter((_, i) => i !== index)))}
                  className="inline-flex h-10 w-10 items-center justify-center justify-self-end rounded-xl text-[var(--text-lo)] hover:bg-[var(--surface-2)] hover:text-red-500"
                  aria-label="Remove task"
                >
                  <Icon icon="solar:trash-bin-minimalistic-broken" className="h-4 w-4" />
                </button>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-4">
                <button type="button" onClick={() => setRows((prev) => [...prev, emptyRow()])} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-500 hover:underline">
                  <Icon icon="solar:add-circle-broken" className="h-4 w-4" /> Add task
                </button>
                <button type="button" onClick={openAsana} className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-lo)] hover:text-[var(--text-hi)]">
                  <Icon icon="solar:import-broken" className="h-4 w-4" /> Import from Asana
                </button>
              </div>
              <p className="text-xs text-[var(--text-lo)]">Total: <span className="font-mono font-semibold text-[var(--text-hi)]">{formatMinutes(totalMinutes)}</span></p>
            </div>
          </div>
        )}

        {asana.open && (
          <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <p className="text-sm font-semibold text-[var(--text-hi)]">Completed in Asana</p>
            {asana.loading ? (
              <p className="text-sm text-[var(--text-lo)]">Loading tasks…</p>
            ) : !asana.connected ? (
              <p className="text-sm text-[var(--text-lo)]">Connect Asana in Settings &gt; Integrations to import tasks.</p>
            ) : asana.tasks.length === 0 ? (
              <p className="text-sm text-[var(--text-lo)]">No tasks were completed in Asana on this day.</p>
            ) : (
              <>
                <div className="max-h-56 space-y-1 overflow-y-auto">
                  {asana.tasks.map((task) => (
                    <label key={task.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-[var(--surface)]">
                      <input
                        type="checkbox"
                        checked={asana.selected.includes(task.id)}
                        onChange={(e) => setAsana((prev) => ({ ...prev, selected: e.target.checked ? [...prev.selected, task.id] : prev.selected.filter((id) => id !== task.id) }))}
                        className="h-4 w-4 accent-brand-500"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-hi)]">{task.name}</span>
                      {task.project && <span className="shrink-0 rounded-md bg-[var(--surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-lo)]">{task.project}</span>}
                    </label>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setAsana((prev) => ({ ...prev, open: false }))}>Cancel</Button>
                  <Button disabled={!asana.selected.length} onClick={addSelectedFromAsana}>Add {asana.selected.length || ""}</Button>
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
          <p className="text-[11px] text-[var(--text-lo)]">{savedAt ? `Last saved ${new Date(savedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : "Not logged yet for this day"}</p>
          <Button icon="solar:diskette-broken" loading={saving} onClick={save}>Save log</Button>
        </div>
      </section>

      {showTeam && (
        <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-hi)]">Team activity</h2>
            <p className="text-[11px] text-[var(--text-lo)]">How each person spent their time on this day.</p>
          </div>
          {team.length === 0 ? (
            <p className="text-sm text-[var(--text-lo)]">No team members to show.</p>
          ) : (
            <div className="max-h-[75vh] space-y-3 overflow-y-auto pr-1">
              {team.map((member) => (
                <div key={member.userId} className="rounded-xl bg-[var(--surface-2)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-hi)]">{member.name}</p>
                      <p className="text-[11px] text-[var(--text-lo)]">{member.jobTitle ?? "Team member"}</p>
                    </div>
                    {member.entries.length ? (
                      <span className="font-mono text-xs font-semibold text-brand-500">{formatMinutes(member.totalMinutes)} logged</span>
                    ) : (
                      <span className="text-xs text-amber-600">Not logged</span>
                    )}
                  </div>
                  {member.entries.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {member.entries.map((entry, index) => (
                        <li key={index} className="flex items-center justify-between gap-3 text-xs">
                          <span className="min-w-0 truncate text-[var(--text-hi)]">{entry.task}</span>
                          <span className="flex shrink-0 items-center gap-2 text-[var(--text-lo)]">
                            <span className="rounded-md bg-[var(--surface)] px-1.5 py-0.5">{entry.category}</span>
                            <span className="font-mono">{formatMinutes(entry.minutes)}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
