"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { ClientSelect } from "./ClientSelect";
import {
  ManageRecurringWorkButton,
  RecurringWorkManager,
} from "./RecurringWorkManager";
import { TeamActivity } from "./TeamActivity";
import { DailyLogRecap, DailyLogHistory } from "./DailyLogRecap";
import {
  DAILY_LOG_CATEGORIES,
  DAILY_LOG_MOOD_COUNT,
  MOOD_LABELS,
  isEditableLogDate,
  clockToMinutes,
  parseDurationMinutes,
  type DailyLogCategory,
  type DailyLogEntry,
} from "../constants";

type Row = {
  id: string;
  task: string;
  client: string;
  showRange: boolean;
  startTime: string;
  endTime: string;
  minutes: string;
  category: DailyLogCategory;
  trackedSeconds?: number;
};
type ActiveTimer = {
  rowId: string;
  date: string;
  startedAt: number;
  accumulatedSeconds: number;
  row: Row;
};
type AsanaTask = { id: string; name: string; project: string | null };
const TIMER_STORAGE_KEY = "kazi:daily-log:active-timer";

const MOODS = ["😔", "😕", "😐", "🙂", "😄"];

const newRowId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `row-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const emptyRow = (): Row => ({
  id: newRowId(),
  task: "",
  client: "",
  showRange: false,
  startTime: "",
  endTime: "",
  minutes: "",
  category: "Projects",
});

function getStoredTimer(date: string): ActiveTimer | null {
  if (typeof window === "undefined") return null;
  try {
    const timer = JSON.parse(
      window.localStorage.getItem(TIMER_STORAGE_KEY) ?? "null",
    ) as ActiveTimer | null;
    return timer?.date === date && timer.rowId && timer.startedAt && timer.row
      ? timer
      : null;
  } catch {
    window.localStorage.removeItem(TIMER_STORAGE_KEY);
    return null;
  }
}

function todayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatMinutes(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours && minutes
    ? `${hours}h ${minutes}m`
    : hours
      ? `${hours}h`
      : `${minutes}m`;
}

function clockFromTimestamp(timestamp: number) {
  const time = new Date(timestamp);
  return `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`;
}

function formatElapsed(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function rowMinutes(
  row: Pick<Row, "showRange" | "startTime" | "endTime" | "minutes">,
): number | null {
  if (row.showRange && row.startTime && row.endTime) {
    const diff = clockToMinutes(row.endTime) - clockToMinutes(row.startTime);
    return diff > 0 ? diff : null;
  }
  return parseDurationMinutes(row.minutes);
}

function dateHeading(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function weekDays(date: string) {
  const selected = new Date(`${date}T12:00:00`);
  const offset = (selected.getDay() + 6) % 7;
  selected.setDate(selected.getDate() - offset);
  return Array.from({ length: 5 }, (_, index) => {
    const day = new Date(selected);
    day.setDate(selected.getDate() + index);
    return {
      key: `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`,
      label: day.toLocaleDateString("en-KE", { weekday: "short" }),
      number: day.getDate(),
    };
  });
}

export function DailyLogPage({
  isReviewer,
  weeklyCheckinSubmitted = false,
}: {
  isReviewer: boolean;
  weeklyCheckinSubmitted?: boolean;
}) {
  const router = useRouter();
  const [date, setDate] = useState(todayLocal);
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [blockers, setBlockers] = useState("");
  const [wins, setWins] = useState("");
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState(false);
  const locked = !isEditableLogDate(date);
  const [savedEntries, setSavedEntries] = useState<DailyLogEntry[]>([]);
  const [history, setHistory] = useState<
    { date: string; entries: DailyLogEntry[]; mood: number | null }[]
  >([]);
  const [notes, setNotes] = useState<
    { id: string; body: string; authorName: string | null; createdAt: string }[]
  >([]);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [timerNow, setTimerNow] = useState(() => Date.now());

  // Notes a manager left on the chosen day, shown read-only.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/pulse/daily-log/comments?date=${date}`)
      .then((res) => res.json())
      .then((json: { comments?: typeof notes }) => {
        if (!cancelled) setNotes(json.comments ?? []);
      })
      .catch(() => !cancelled && setNotes([]));
    return () => {
      cancelled = true;
    };
  }, [date]);
  const [clients, setClients] = useState<string[]>([]);
  const [asana, setAsana] = useState<{
    open: boolean;
    loading: boolean;
    connected: boolean;
    tasks: AsanaTask[];
    selected: string[];
  }>({
    open: false,
    loading: false,
    connected: false,
    tasks: [],
    selected: [],
  });

  useEffect(() => {
    fetch("/api/pulse/daily-log/clients")
      .then((res) => res.json())
      .then((json: { clients?: string[] }) => setClients(json.clients ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- date changes must show loading while the selected log is fetched.
    setLoading(true);
    fetch(`/api/pulse/daily-log?date=${date}`)
      .then((res) => res.json())
      .then(
        (json: {
          entries?: DailyLogEntry[];
          updatedAt?: string | null;
          edited?: boolean;
          mood?: number | null;
          blockers?: string | null;
          wins?: string | null;
          error?: string;
        }) => {
          if (cancelled) return;
          if (json.error) throw new Error(json.error);
          const loaded = json.entries ?? [];
          const restoredTimer = isReviewer ? null : getStoredTimer(date);
          const loadedRows = loaded.length
            ? loaded.map((entry) => ({
                id: newRowId(),
                task: entry.task,
                client: entry.client ?? "",
                showRange: !!(entry.startTime && entry.endTime),
                startTime: entry.startTime ?? "",
                endTime: entry.endTime ?? "",
                minutes: formatMinutes(entry.minutes),
                category: entry.category,
              }))
            : [emptyRow()];
          setRows(
            restoredTimer ? [...loadedRows, restoredTimer.row] : loadedRows,
          );
          setActiveTimer(restoredTimer);
          setSavedAt(json.updatedAt ?? null);
          setSavedEntries(loaded);
          setEdited(json.edited ?? false);
          setEditing(false);
          setMood(json.mood ?? null);
          setBlockers(json.blockers ?? "");
          setWins(json.wins ?? "");
        },
      )
      .catch((err: Error) => !cancelled && toast.error(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [date, isReviewer]);

  useEffect(() => {
    if (!activeTimer) return;
    const interval = window.setInterval(() => setTimerNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [activeTimer]);

  useEffect(() => {
    if (isReviewer) return;
    let cancelled = false;
    const selected = new Date(`${date}T12:00:00`);
    selected.setDate(selected.getDate() - ((selected.getDay() + 6) % 7));
    const from = selected;
    const to = new Date(selected);
    to.setDate(selected.getDate() + 4);
    const key = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    fetch(`/api/pulse/daily-log?scope=history&from=${key(from)}&to=${key(to)}`)
      .then((res) => res.json())
      .then(
        (json: {
          logs?: {
            date: string;
            entries: DailyLogEntry[];
            mood: number | null;
          }[];
        }) => {
          if (!cancelled) setHistory(json.logs ?? []);
        },
      )
      .catch(() => !cancelled && setHistory([]));
    return () => {
      cancelled = true;
    };
  }, [date, isReviewer, savedAt]);

  const totalMinutes = rows.reduce(
    (sum, row) => sum + (rowMinutes(row) ?? 0),
    0,
  );
  const activeWeek = weekDays(date);
  const weeklyLogs = history.filter((log) =>
    activeWeek.some((day) => day.key === log.date),
  );
  const weeklyMinutes = weeklyLogs.reduce(
    (sum, log) =>
      sum +
      log.entries.reduce((entryTotal, entry) => entryTotal + entry.minutes, 0),
    0,
  );
  const loggedDays = new Set(
    weeklyLogs.filter((log) => log.entries.length > 0).map((log) => log.date),
  );
  const weekComplete = activeWeek.every((day) => loggedDays.has(day.key));

  const updateRow = (index: number, patch: Partial<Row>) => {
    const adjustedTime =
      "minutes" in patch ||
      "startTime" in patch ||
      "endTime" in patch ||
      "showRange" in patch;
    setRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              ...patch,
              // A manual edit is intentional. On the next resume, calculate
              // from the visible duration/range instead of stale timer seconds.
              ...(adjustedTime && activeTimer?.rowId !== row.id
                ? { trackedSeconds: undefined }
                : {}),
            }
          : row,
      ),
    );
  };

  const startTimer = (index: number) => {
    const row = rows[index];
    if (!row.task.trim()) {
      toast.error("Name the activity before starting a timer.");
      return;
    }
    if (activeTimer) {
      toast.error("Stop the current timer before starting another one.");
      return;
    }
    const startedAt = Date.now();
    const timer: ActiveTimer = {
      rowId: row.id,
      date,
      startedAt,
      accumulatedSeconds: row.trackedSeconds ?? (rowMinutes(row) ?? 0) * 60,
      row: {
        ...row,
        showRange: true,
        startTime: clockFromTimestamp(startedAt),
        endTime: "",
        minutes: "",
      },
    };
    updateRow(index, timer.row);
    window.localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(timer));
    setActiveTimer(timer);
    setTimerNow(startedAt);
  };

  const stopTimer = () => {
    if (!activeTimer) return;
    const stoppedAt = Date.now();
    const elapsedSeconds = Math.max(
      0,
      Math.floor((stoppedAt - activeTimer.startedAt) / 1000),
    );
    const totalSeconds = (activeTimer.accumulatedSeconds ?? 0) + elapsedSeconds;
    const totalMinutes = Math.max(1, Math.floor(totalSeconds / 60));
    const canKeepRange =
      activeTimer.accumulatedSeconds === 0 && elapsedSeconds >= 60;
    setRows((current) =>
      current.map((row) =>
        row.id === activeTimer.rowId
          ? {
              ...row,
              // Multiple intervals cannot be represented by one time range.
              showRange: canKeepRange,
              startTime: canKeepRange
                ? clockFromTimestamp(activeTimer.startedAt)
                : "",
              endTime: canKeepRange ? clockFromTimestamp(stoppedAt) : "",
              minutes: formatMinutes(totalMinutes),
              trackedSeconds: totalSeconds,
            }
          : row,
      ),
    );
    window.localStorage.removeItem(TIMER_STORAGE_KEY);
    setActiveTimer(null);
    toast.success(`Timer stopped at ${formatElapsed(totalSeconds * 1000)}.`);
  };

  const addSavedClient = (name: string) =>
    setClients((prev) =>
      prev.includes(name)
        ? prev
        : [...prev, name].sort((a, b) => a.localeCompare(b)),
    );

  const openAsana = async () => {
    setAsana((prev) => ({ ...prev, open: true, loading: true, selected: [] }));
    try {
      const res = await fetch(`/api/pulse/checkins/asana-tasks?date=${date}`);
      const json = (await res.json()) as {
        connected?: boolean;
        tasks?: AsanaTask[];
        error?: string;
      };
      if (json.error) throw new Error(json.error);
      setAsana({
        open: true,
        loading: false,
        connected: !!json.connected,
        tasks: json.tasks ?? [],
        selected: [],
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not load Asana tasks",
      );
      setAsana((prev) => ({ ...prev, loading: false }));
    }
  };

  const addSelectedFromAsana = () => {
    const picked = asana.tasks.filter((task) =>
      asana.selected.includes(task.id),
    );
    setRows((prev) => {
      const base =
        prev.length === 1 &&
        !prev[0].task &&
        !prev[0].minutes &&
        !prev[0].startTime
          ? []
          : prev;
      return [
        ...base,
        ...picked.map((task) => ({
          ...emptyRow(),
          task: task.project ? `${task.project}: ${task.name}` : task.name,
        })),
      ];
    });
    setAsana((prev) => ({ ...prev, open: false }));
  };

  const addRecurringWork = (entry: DailyLogEntry) => {
    setRows((prev) => {
      const base =
        prev.length === 1 &&
        !prev[0].task &&
        !prev[0].minutes &&
        !prev[0].startTime
          ? []
          : prev;
      return [
        ...base,
        {
          ...emptyRow(),
          task: entry.task,
          client: entry.client ?? "",
          minutes: formatMinutes(entry.minutes),
          category: entry.category,
        },
      ];
    });
    toast.success("Added to today’s log. Adjust it if needed before saving.");
  };

  const removeRow = (index: number) => {
    const removed = rows[index];
    if (!removed) return;
    setRows((current) =>
      current.length === 1
        ? [emptyRow()]
        : current.filter((_, rowIndex) => rowIndex !== index),
    );
    toast(
      (notification) => (
        <div className="flex items-center gap-3 text-sm text-[var(--text-hi)]">
          <span>Activity removed</span>
          <button
            type="button"
            onClick={() => {
              setRows((current) => {
                if (current.some((row) => row.id === removed.id))
                  return current;
                if (
                  current.length === 1 &&
                  !current[0].task &&
                  !current[0].minutes &&
                  !current[0].startTime
                )
                  return [removed];
                const restored = [...current];
                restored.splice(Math.min(index, restored.length), 0, removed);
                return restored;
              });
              toast.dismiss(notification.id);
            }}
            className="font-semibold text-brand-500 hover:text-brand-600"
          >
            Undo
          </button>
        </div>
      ),
      {
        duration: 5000,
        style: {
          background: "var(--surface)",
          color: "var(--text-hi)",
          border: "1px solid var(--border)",
        },
      },
    );
  };

  const save = async () => {
    if (activeTimer?.date === date) {
      toast.error("Stop the active timer before saving this daily log.");
      return;
    }
    const filled = rows.filter(
      (row) =>
        row.task.trim() || row.minutes.trim() || row.startTime || row.endTime,
    );
    if (!filled.length) {
      toast.error("Add at least one task");
      return;
    }
    const entries: DailyLogEntry[] = [];
    for (const row of filled) {
      const minutes = rowMinutes(row);
      if (minutes === null) {
        toast.error(
          `Check the time for "${row.task || "a task"}". Use a duration like 45m or 1h 30m, or a range where the end is after the start.`,
        );
        return;
      }
      const hasRange = row.showRange && row.startTime && row.endTime;
      entries.push({
        task: row.task.trim(),
        client: row.client.trim() || null,
        minutes,
        category: row.category,
        startTime: hasRange ? row.startTime : null,
        endTime: hasRange ? row.endTime : null,
      });
    }

    setSaving(true);
    try {
      const res = await fetch("/api/pulse/daily-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          entries,
          mood,
          blockers: blockers.trim() || null,
          wins: wins.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) throw new Error(json?.error ?? "Could not save your log");
      setSavedAt(new Date().toISOString());
      setSavedEntries(entries);
      setHistory((current) => [
        ...current.filter((log) => log.date !== date),
        { date, entries, mood },
      ]);
      setEditing(false);
      const daysAfterSave = new Set(loggedDays);
      daysAfterSave.add(date);
      const completedAfterSave = activeWeek.every((day) =>
        daysAfterSave.has(day.key),
      );
      if (completedAfterSave && !weeklyCheckinSubmitted) {
        toast.success("Your daily week is ready to review.");
        router.push("/pulse/checkins?tab=checkins");
        return;
      }
      toast.success(
        completedAfterSave
          ? "Daily work saved for this week."
          : "Daily log shared with your manager.",
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save your log",
      );
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60";
  const timeClass =
    "rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-hi)] outline-none focus:border-brand-500";

  return (
    <div className="space-y-6">
      <SetPageHeader
        title={isReviewer ? "Daily reporting" : "Daily log"}
        description={
          isReviewer
            ? "Daily reporting coverage, work evidence, and support signals across your team."
            : `${dateHeading(date)} · what you worked on and how long it took`
        }
        icon="solar:notebook-broken"
      />

      {!isReviewer && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-xl ${weekComplete ? "bg-emerald-500/10 text-emerald-600" : "bg-brand-500/10 text-brand-500"}`}
                >
                  <Icon
                    icon={
                      weekComplete
                        ? "solar:check-circle-broken"
                        : "solar:calendar-mark-broken"
                    }
                    className="h-4 w-4"
                  />
                </span>
                <div>
                  <h2 className="text-md font-semibold text-[var(--text-hi)]">
                    {weekComplete
                      ? "Your week is ready to review"
                      : "This week's report"}
                  </h2>
                  <p className="mt-0.5 text-xs text-[var(--text-lo)]">
                    {weekComplete
                      ? "Your daily work is shared. Add your reflection, then submit when you are ready."
                      : "Log work each day, then complete your reflection by Friday."}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-[var(--text-lo)]">
                <span
                  className={`font-semibold ${weekComplete ? "text-emerald-600" : "text-brand-500"}`}
                >
                  {loggedDays.size}/5 days logged
                </span>{" "}
                · {formatMinutes(weeklyMinutes)} tracked this week
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 rounded-xl bg-[var(--surface-2)] p-1">
                {activeWeek.map((day) => {
                  const selected = day.key === date;
                  const logged = loggedDays.has(day.key);
                  const future = day.key > todayLocal();
                  return (
                    <button
                      key={day.key}
                      type="button"
                      disabled={future}
                      onClick={() => setDate(day.key)}
                      className={`flex min-w-11 flex-col items-center rounded-lg px-2 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${selected ? "bg-[var(--surface)] text-brand-500 shadow-sm" : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"}`}
                    >
                      <span className="font-medium">{day.label}</span>
                      <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px]">
                        {logged ? (
                          <Icon
                            icon="solar:check-circle-bold"
                            className="h-3.5 w-3.5 text-emerald-500"
                          />
                        ) : future ? (
                          ""
                        ) : (
                          day.number
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
              <Link
                href="/pulse/checkins?tab=checkins"
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-600"
              >
                <Icon
                  icon="solar:check-circle-broken"
                  className="h-3.5 w-3.5"
                />
                {weekComplete && !weeklyCheckinSubmitted
                  ? "Complete weekly check-in"
                  : weekComplete
                    ? "View weekly check-in"
                    : "Weekly reflection"}
              </Link>
            </div>
          </div>
        </section>
      )}

      {!isReviewer && savedAt && !editing && !loading ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-hi)]">
                Daily activity log
              </h2>
              <p className="text-[11px] text-[var(--text-lo)]">
                Review a day, or pick another to log it.
              </p>
            </div>
            <div className="w-48">
              <DatePicker
                value={date}
                onChange={setDate}
                maxDate={new Date()}
              />
            </div>
          </div>
          <DailyLogRecap
            dateLabel={dateHeading(date)}
            entries={savedEntries}
            mood={mood}
            blockers={blockers.trim() || null}
            wins={wins.trim() || null}
            updatedAt={savedAt}
            edited={edited}
            canEdit={!locked}
            onEdit={() => setEditing(true)}
          />
          <RecurringWorkManager
            date={date}
            clients={clients}
            onClientCreated={addSavedClient}
            onAdd={(entry) => {
              addRecurringWork(entry);
              setEditing(true);
            }}
          />
          {notes.length > 0 && (
            <div className="space-y-2 rounded-xl border border-brand-500/20 bg-brand-500/[0.04] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-lo)]">
                Notes from your manager
              </p>
              {notes.map((note) => (
                <div key={note.id} className="text-xs">
                  <p className="text-[var(--text-hi)]">{note.body}</p>
                  <p className="mt-0.5 text-[10px] text-[var(--text-lo)]">
                    {note.authorName ?? "Manager"} ·{" "}
                    {new Date(note.createdAt).toLocaleString("en-KE", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        !isReviewer && (
          <section className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 hover:shadow-2xl dark:shadow-black/20 transition-shadow duration-200 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/10">
                  <Icon
                    icon="solar:notebook-broken"
                    className="h-3.5 w-3.5 text-brand-500"
                  />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-[var(--text-hi)]">
                    Activity
                  </h2>
                  <p className="text-[11px] text-[var(--text-lo)]">
                    Add each task with how long it took.
                  </p>
                </div>
              </div>
              <div className="w-48">
                <DatePicker
                  value={date}
                  onChange={setDate}
                  maxDate={new Date()}
                />
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-[var(--text-lo)]">Loading…</p>
            ) : (
              <div className="space-y-3">
                <RecurringWorkManager
                  date={date}
                  clients={clients}
                  onClientCreated={addSavedClient}
                  onAdd={addRecurringWork}
                  showManageTrigger={false}
                />
                {rows.map((row, index) => (
                  <div key={row.id} className="space-y-2">
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_170px_150px_130px_auto]">
                      <input
                        value={row.task}
                        onChange={(e) =>
                          updateRow(index, { task: e.target.value })
                        }
                        placeholder="What did you work on?"
                        aria-label="Activity or task"
                        maxLength={200}
                        className={inputClass}
                      />
                      <div className="min-w-0">
                        <ClientSelect
                          value={row.client}
                          onChange={(client) => updateRow(index, { client })}
                          clients={clients}
                          onClientCreated={addSavedClient}
                          ariaLabel="Client or project"
                        />
                      </div>
                      <input
                        value={
                          activeTimer?.rowId === row.id
                            ? formatElapsed(
                                activeTimer.accumulatedSeconds * 1000 +
                                  timerNow -
                                  activeTimer.startedAt,
                              )
                            : row.showRange && row.startTime && row.endTime
                              ? formatMinutes(rowMinutes(row) ?? 0)
                              : row.minutes
                        }
                        disabled={
                          activeTimer?.rowId === row.id ||
                          (row.showRange && !!row.startTime && !!row.endTime)
                        }
                        onChange={(e) =>
                          updateRow(index, { minutes: e.target.value })
                        }
                        placeholder="Duration, e.g. 1h 30m"
                        aria-label="Duration"
                        className={inputClass}
                      />
                      <select
                        value={row.category}
                        aria-label="Activity category"
                        onChange={(e) =>
                          updateRow(index, {
                            category: e.target.value as DailyLogCategory,
                          })
                        }
                        className={inputClass}
                      >
                        {DAILY_LOG_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center justify-self-end">
                        {activeTimer?.rowId === row.id ? (
                          <button
                            type="button"
                            onClick={stopTimer}
                            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-red-500/10 px-2 text-xs font-mono font-semibold text-red-500 hover:bg-red-500/15"
                            aria-label="Stop timer"
                            title="Stop timer"
                          >
                            <Icon
                              icon="solar:stop-circle-broken"
                              className="h-4 w-4"
                            />
                            {formatElapsed(
                              activeTimer.accumulatedSeconds * 1000 +
                                timerNow -
                                activeTimer.startedAt,
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startTimer(index)}
                            disabled={Boolean(activeTimer) || !row.task.trim()}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-brand-500 hover:bg-brand-500/10 disabled:cursor-not-allowed disabled:opacity-35"
                            aria-label={`Start timer for ${row.task || "activity"}`}
                            title="Start timer"
                          >
                            <Icon
                              icon="solar:play-circle-broken"
                              className="h-4 w-4"
                            />
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={activeTimer?.rowId === row.id}
                          onClick={() => removeRow(index)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-lo)] hover:bg-[var(--surface-2)] hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-35"
                          aria-label="Remove task"
                        >
                          <Icon
                            icon="solar:trash-bin-minimalistic-broken"
                            className="h-4 w-4"
                          />
                        </button>
                      </div>
                    </div>
                    {row.showRange ? (
                      <div className="flex flex-wrap items-center gap-2 pl-1 text-xs text-[var(--text-lo)]">
                        <span>From</span>
                        <input
                          type="time"
                          aria-label="Start time"
                          value={row.startTime}
                          disabled={activeTimer?.rowId === row.id}
                          onChange={(e) =>
                            updateRow(index, { startTime: e.target.value })
                          }
                          className={timeClass}
                        />
                        <span>to</span>
                        <input
                          type="time"
                          aria-label="End time"
                          value={row.endTime}
                          disabled={activeTimer?.rowId === row.id}
                          onChange={(e) =>
                            updateRow(index, { endTime: e.target.value })
                          }
                          className={timeClass}
                        />
                        <button
                          type="button"
                          disabled={activeTimer?.rowId === row.id}
                          onClick={() =>
                            updateRow(index, {
                              showRange: false,
                              startTime: "",
                              endTime: "",
                            })
                          }
                          className="ml-1 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          Remove time range
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => updateRow(index, { showRange: true })}
                        className="pl-1 text-xs font-medium text-[var(--text-lo)] hover:text-brand-500"
                      >
                        + Set a time range
                      </button>
                    )}
                  </div>
                ))}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setRows((prev) => [...prev, emptyRow()])}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-500 hover:underline"
                    >
                      <Icon
                        icon="solar:add-circle-broken"
                        className="h-4 w-4"
                      />{" "}
                      Add task
                    </button>
                    <button
                      type="button"
                      onClick={openAsana}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-lo)] hover:text-[var(--text-hi)]"
                    >
                      <Icon icon="solar:import-broken" className="h-4 w-4" />{" "}
                      Import from Asana
                    </button>
                    <ManageRecurringWorkButton
                      date={date}
                      clients={clients}
                      onClientCreated={addSavedClient}
                    />
                  </div>
                  <p className="text-xs text-[var(--text-lo)]">
                    Total:{" "}
                    <span className="font-mono font-semibold text-[var(--text-hi)]">
                      {formatMinutes(totalMinutes)}
                    </span>
                  </p>
                </div>
              </div>
            )}

            {asana.open && (
              <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                <p className="text-sm font-semibold text-[var(--text-hi)]">
                  Completed in Asana
                </p>
                {asana.loading ? (
                  <p className="text-sm text-[var(--text-lo)]">
                    Loading tasks…
                  </p>
                ) : !asana.connected ? (
                  <p className="text-sm text-[var(--text-lo)]">
                    Connect Asana in Settings &gt; Integrations to import tasks.
                  </p>
                ) : asana.tasks.length === 0 ? (
                  <p className="text-sm text-[var(--text-lo)]">
                    No tasks were completed in Asana on this day.
                  </p>
                ) : (
                  <>
                    <div className="max-h-56 space-y-1 overflow-y-auto">
                      {asana.tasks.map((task) => (
                        <label
                          key={task.id}
                          className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-[var(--surface)]"
                        >
                          <input
                            type="checkbox"
                            checked={asana.selected.includes(task.id)}
                            onChange={(e) =>
                              setAsana((prev) => ({
                                ...prev,
                                selected: e.target.checked
                                  ? [...prev.selected, task.id]
                                  : prev.selected.filter(
                                      (id) => id !== task.id,
                                    ),
                              }))
                            }
                            className="h-4 w-4 accent-brand-500"
                          />
                          <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-hi)]">
                            {task.name}
                          </span>
                          {task.project && (
                            <span className="shrink-0 rounded-md bg-[var(--surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-lo)]">
                              {task.project}
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setAsana((prev) => ({ ...prev, open: false }))
                        }
                      >
                        Cancel
                      </Button>
                      <Button
                        disabled={!asana.selected.length}
                        onClick={addSelectedFromAsana}
                      >
                        Add {asana.selected.length || ""}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="grid gap-4 border-t border-[var(--border)] pt-4 sm:grid-cols-3">
              <div>
                <p className="mb-2 text-xs font-semibold text-[var(--text-hi)]">
                  How did today feel?
                </p>
                <div className="flex gap-1.5">
                  {MOODS.slice(0, DAILY_LOG_MOOD_COUNT).map((emoji, index) => {
                    const value = index + 1;
                    return (
                      <button
                        key={value}
                        type="button"
                        title={MOOD_LABELS[index]}
                        aria-label={`Mood ${value} of ${DAILY_LOG_MOOD_COUNT}: ${MOOD_LABELS[index]}`}
                        onClick={() => setMood(mood === value ? null : value)}
                        aria-pressed={mood === value}
                        className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg transition-colors ${mood === value ? "bg-brand-500/15 ring-2 ring-brand-500/40" : "bg-[var(--surface-2)] hover:bg-[var(--surface)]"}`}
                      >
                        {emoji}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-[var(--text-lo)]">
                  {mood ? (
                    <>
                      Feeling{" "}
                      <span className="font-semibold text-[var(--text-hi)]">
                        {MOOD_LABELS[mood - 1]}
                      </span>
                    </>
                  ) : (
                    "No mood selected"
                  )}
                </p>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold text-[var(--text-hi)]">
                  Blockers{" "}
                  <span className="font-normal text-[var(--text-lo)]">
                    Optional
                  </span>
                </label>
                <textarea
                  rows={2}
                  value={blockers}
                  onChange={(e) => setBlockers(e.target.value)}
                  placeholder="Anything slowing you down?"
                  maxLength={1000}
                  className={`${inputClass} resize-y`}
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold text-[var(--text-hi)]">
                  Wins and learnings{" "}
                  <span className="font-normal text-[var(--text-lo)]">
                    Optional
                  </span>
                </label>
                <textarea
                  rows={2}
                  value={wins}
                  onChange={(e) => setWins(e.target.value)}
                  placeholder="What went well, or what did you learn?"
                  maxLength={1000}
                  className={`${inputClass} resize-y`}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
              <p className="text-[11px] text-[var(--text-lo)]">
                {savedAt
                  ? `Last saved ${new Date(savedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                  : "Not logged yet for this day"}
              </p>
              <Button
                icon="solar:diskette-broken"
                loading={saving}
                disabled={locked}
                onClick={save}
              >
                Save & share daily log
              </Button>
            </div>
          </section>
        )
      )}

      {!isReviewer && (
        <DailyLogHistory logs={history} selected={date} onSelect={setDate} />
      )}

      {isReviewer && <TeamActivity />}
    </div>
  );
}
