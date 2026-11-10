"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { Accordion } from "@/components/ui/Accordion";
import { DatePicker } from "@/components/ui/DatePicker";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { ClientSelect } from "./ClientSelect";
import {
  ManageRecurringWorkButton,
  RecurringWorkManager,
} from "./RecurringWorkManager";
import { TeamActivity } from "./TeamActivity";
import { activeTimerTabEvent } from "@/components/providers/ActiveTimerTabIndicator";
import { useUnsavedChanges } from "@/shared/contexts/UnsavedChangesContext";
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
import type { SharedActiveTimer } from "../shared-timer";

type Row = {
  id: string;
  task: string;
  client: string;
  showRange: boolean;
  startTime: string;
  endTime: string;
  claimOutsideHours: boolean;
  outsideHoursReason: string;
  minutes: string;
  category: DailyLogCategory;
  trackedSeconds?: number;
};
type ActiveTimer = {
  /** Shared timer id, the idempotency key the server uses for stop. */
  id: string;
  rowId: string;
  date: string;
  running: boolean;
  /** Start of the current running interval, or null while paused. */
  startedAt: number | null;
  accumulatedMs: number;
  source: "kazi" | "extension";
  row: Row;
};
type AsanaTask = { id: string; name: string; project: string | null };
// The server owns the active timer. This key is only a recovery cache for
// when the timer API cannot be reached.
const TIMER_STORAGE_KEY = "kazi:daily-log:active-timer";
const TIMER_RECONCILE_COOLDOWN_MS = 30_000;
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
  claimOutsideHours: false,
  outsideHoursReason: "",
  minutes: "",
  category: "Projects",
});

function getStoredTimer(date: string): ActiveTimer | null {
  if (typeof window === "undefined") return null;
  try {
    const timer = JSON.parse(
      window.localStorage.getItem(TIMER_STORAGE_KEY) ?? "null",
    ) as ActiveTimer | null;
    return timer?.date === date && timer.id && timer.row ? timer : null;
  } catch {
    window.localStorage.removeItem(TIMER_STORAGE_KEY);
    return null;
  }
}

function cacheActiveTimer(timer: ActiveTimer | null) {
  try {
    if (timer)
      window.localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(timer));
    else window.localStorage.removeItem(TIMER_STORAGE_KEY);
  } catch {
    // Storage can be blocked. The server copy is still authoritative.
  }
  window.dispatchEvent(new Event(activeTimerTabEvent));
}

type SharedTimerState = {
  timer: SharedActiveTimer | null;
  /** Entry written when the page's timer was stopped elsewhere. */
  stopped: DailyLogEntry | null;
  /** True when the minutes were added to an existing entry for the task. */
  merged: boolean;
};

/**
 * Shows a stopped timer in the log. When the server added the minutes to an
 * existing row for the same task, that row takes the new total and the timer
 * row goes away, so the task keeps one row.
 */
function applyStoppedEntry(
  rows: Row[],
  timerRowId: string,
  stopped: DailyLogEntry,
  merged: boolean,
): Row[] {
  const minutes = formatMinutes(stopped.minutes);
  if (merged) {
    const sibling = rows.find(
      (row) =>
        row.id !== timerRowId &&
        !row.showRange &&
        !row.claimOutsideHours &&
        row.task.trim().toLowerCase() === stopped.task.trim().toLowerCase() &&
        row.client.trim() === (stopped.client ?? "").trim() &&
        row.category === stopped.category,
    );
    if (sibling)
      return rows
        .filter((row) => row.id !== timerRowId)
        .map((row) => (row.id === sibling.id ? { ...row, minutes } : row));
  }
  return rows.map((row) =>
    row.id === timerRowId
      ? { ...row, showRange: false, startTime: "", endTime: "", minutes }
      : row,
  );
}

/** A plain row for the same activity that a running timer can take over. */
function canResumeRow(
  row: Row,
  timer: Pick<Row, "task" | "client" | "category">,
) {
  return (
    !row.showRange &&
    !row.claimOutsideHours &&
    row.task.trim().toLowerCase() === timer.task.trim().toLowerCase() &&
    row.client.trim() === timer.client.trim() &&
    row.category === timer.category
  );
}

/** undefined means the timer API could not be reached. */
async function fetchSharedTimer(
  stoppedTimerId?: string,
): Promise<SharedTimerState | undefined> {
  try {
    const query = stoppedTimerId
      ? `?stoppedTimerId=${encodeURIComponent(stoppedTimerId)}`
      : "";
    const response = await fetch(`/api/pulse/daily-log/timer${query}`, {
      cache: "no-store",
    });
    if (!response.ok) return undefined;
    const json = (await response.json()) as {
      timer?: SharedActiveTimer | null;
      stopped?: DailyLogEntry | null;
      merged?: boolean;
    };
    return {
      timer: json.timer ?? null,
      stopped: json.stopped ?? null,
      merged: json.merged === true,
    };
  } catch {
    return undefined;
  }
}

function timerElapsedMs(timer: ActiveTimer, now: number) {
  return (
    timer.accumulatedMs +
    (timer.running && timer.startedAt ? now - timer.startedAt : 0)
  );
}

function rowFromSharedTimer(timer: SharedActiveTimer): Row {
  const startedAt = timer.startedAt ? Date.parse(timer.startedAt) : Date.now();
  return {
    ...emptyRow(),
    id: timer.id,
    task: timer.task,
    client: timer.client ?? "",
    category: timer.category,
    showRange: true,
    startTime: clockFromTimestamp(startedAt),
    endTime: "",
    minutes: "",
  };
}

function activeTimerFromShared(timer: SharedActiveTimer): ActiveTimer {
  return {
    id: timer.id,
    rowId: timer.id,
    date: timer.logDate,
    running: timer.running,
    startedAt: timer.startedAt ? Date.parse(timer.startedAt) : null,
    accumulatedMs: timer.accumulatedMs,
    source: timer.source,
    row: rowFromSharedTimer(timer),
  };
}

/** Keep the row the page already shows, and only refresh the timer state. */
function mergeSharedTimer(
  current: ActiveTimer | null,
  timer: SharedActiveTimer,
): ActiveTimer {
  if (current?.id !== timer.id) return activeTimerFromShared(timer);
  return {
    ...current,
    running: timer.running,
    startedAt: timer.startedAt ? Date.parse(timer.startedAt) : null,
    accumulatedMs: timer.accumulatedMs,
    source: timer.source,
  };
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
  isReviewer = false,
  reviewerReportId,
  weeklyCheckinSubmitted = false,
  weeklyCheckinHref = "/pulse/checkins?tab=checkins",
}: {
  isReviewer?: boolean;
  reviewerReportId?: string;
  weeklyCheckinSubmitted?: boolean;
  weeklyCheckinHref?: string;
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
  const [isDirty, setIsDirty] = useState(false);
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
  // Set when a timer was stopped elsewhere while this page had unsaved edits.
  // Saving would overwrite the time logged elsewhere, so it is blocked.
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const activeTimerRef = useRef<ActiveTimer | null>(null);
  const rowsRef = useRef<Row[]>([]);
  const isDirtyRef = useRef(false);
  // Timer changes made here win over a simultaneous focus or storage refresh.
  const lastLocalTimerChange = useRef(0);
  // A browser return commonly fires visibility and focus together. The timer
  // clock is local, so those recovery reads can be safely coalesced.
  const lastTimerReconciledAt = useRef(0);
  const pendingTimerRequests = useRef(0);
  const { confirmNavigation, setUnsaved, setCallbacks } = useUnsavedChanges();
  const saveRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    activeTimerRef.current = activeTimer;
  }, [activeTimer]);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

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
    const sharedTimerRequest = isReviewer
      ? Promise.resolve<SharedTimerState | undefined>({
          timer: null,
          stopped: null,
          merged: false,
        })
      : fetchSharedTimer();
    Promise.all([
      fetch(`/api/pulse/daily-log?date=${date}`).then((res) => res.json()),
      sharedTimerRequest,
    ])
      .then(
        ([json, sharedTimer]: [
          {
            entries?: DailyLogEntry[];
            updatedAt?: string | null;
            edited?: boolean;
            mood?: number | null;
            blockers?: string | null;
            wins?: string | null;
            error?: string;
          },
          SharedTimerState | undefined,
        ]) => {
          if (cancelled) return;
          if (sharedTimer !== undefined)
            lastTimerReconciledAt.current = Date.now();
          if (json.error) throw new Error(json.error);
          const loaded = json.entries ?? [];
          // The server copy wins. The cache is only used when it cannot be reached.
          const restoredTimer =
            sharedTimer === undefined
              ? isReviewer
                ? null
                : getStoredTimer(date)
              : sharedTimer.timer?.logDate === date
                ? activeTimerFromShared(sharedTimer.timer)
                : null;
          const loadedRows = loaded.length
            ? loaded.map((entry) => ({
                id: newRowId(),
                task: entry.task,
                client: entry.client ?? "",
                showRange: !!(entry.startTime && entry.endTime),
                startTime: entry.startTime ?? "",
                endTime: entry.endTime ?? "",
                claimOutsideHours: entry.claimOutsideHours ?? false,
                outsideHoursReason: entry.outsideHoursReason ?? "",
                minutes: formatMinutes(entry.minutes),
                category: entry.category,
              }))
            : [emptyRow()];
          // A running timer resumes the task's existing row when there is one.
          const resumable = restoredTimer
            ? loadedRows.find((row) => canResumeRow(row, restoredTimer.row))
            : undefined;
          const resumedTimer =
            restoredTimer && resumable
              ? { ...restoredTimer, rowId: resumable.id }
              : restoredTimer;
          setRows(
            restoredTimer && resumable
              ? loadedRows.map((row) =>
                  row.id === resumable.id
                    ? { ...restoredTimer.row, id: resumable.id }
                    : row,
                )
              : restoredTimer
                ? [...loadedRows, restoredTimer.row]
                : loadedRows,
          );
          setActiveTimer(resumedTimer);
          if (resumedTimer) cacheActiveTimer(resumedTimer);
          setNeedsRefresh(false);
          setSavedAt(json.updatedAt ?? null);
          setSavedEntries(loaded);
          setEdited(json.edited ?? false);
          setEditing(false);
          setIsDirty(false);
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
  }, [date, isReviewer, reloadKey]);

  // Reconcile when this view becomes relevant again, instead of polling while
  // a timer runs. Elapsed time is calculated locally from the start timestamp;
  // the server is only needed for lifecycle events and cross-window recovery.
  useEffect(() => {
    if (isReviewer) return;
    let cancelled = false;
    let inFlight = false;

    const reconcile = ({
      timer: shared,
      stopped,
      merged,
    }: SharedTimerState) => {
      const current = activeTimerRef.current;
      const matching = shared?.logDate === date ? shared : null;

      if (current && current.id !== matching?.id) {
        // Stopped, or replaced, somewhere else.
        cacheActiveTimer(null);
        setActiveTimer(null);
        if (stopped) {
          // The server already wrote the entry, so show its duration in this
          // row instead of asking for a refresh.
          const stoppedEntry = stopped;
          setRows((rows) =>
            applyStoppedEntry(rows, current.rowId, stoppedEntry, merged),
          );
          toast.success(
            `Timer stopped in another window at ${formatMinutes(stopped.minutes)}.`,
          );
        } else if (isDirtyRef.current) {
          setNeedsRefresh(true);
          toast.error(
            "Your timer was stopped in another window. Refresh this log before saving.",
          );
        } else {
          setReloadKey((key) => key + 1);
        }
      }
      if (!matching) return;
      if (current?.id === matching.id) {
        setActiveTimer((prev) =>
          prev ? mergeSharedTimer(prev, matching) : prev,
        );
        return;
      }
      const next = activeTimerFromShared(matching);
      // A timer for a task already in the log resumes that row, so the task
      // keeps one row. Otherwise the timer gets its own row.
      const resumable = rowsRef.current.find((row) =>
        canResumeRow(row, {
          task: matching.task,
          client: matching.client ?? "",
          category: matching.category,
        }),
      );
      if (resumable) {
        const resumed: ActiveTimer = { ...next, rowId: resumable.id };
        setRows((rows) =>
          rows.map((row) =>
            row.id === resumable.id ? { ...next.row, id: resumable.id } : row,
          ),
        );
        setActiveTimer(resumed);
        cacheActiveTimer(resumed);
        return;
      }
      setRows((rows) =>
        rows.some((row) => row.id === next.rowId) ? rows : [...rows, next.row],
      );
      setActiveTimer(next);
      cacheActiveTimer(next);
    };

    const sync = async ({ force = false } = {}) => {
      if (inFlight || pendingTimerRequests.current > 0) return;
      if (
        !force &&
        Date.now() - lastTimerReconciledAt.current < TIMER_RECONCILE_COOLDOWN_MS
      )
        return;
      inFlight = true;
      const requestedAt = Date.now();
      const shared = await fetchSharedTimer(activeTimerRef.current?.id);
      inFlight = false;
      if (cancelled || shared === undefined) return;
      lastTimerReconciledAt.current = Date.now();
      if (
        pendingTimerRequests.current > 0 ||
        lastLocalTimerChange.current > requestedAt
      )
        return;
      reconcile(shared);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void sync();
    };
    const onFocus = () => void sync();
    const onStorage = (event: StorageEvent) => {
      if (event.key === TIMER_STORAGE_KEY) void sync({ force: true });
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
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
  const weekShared = weeklyCheckinSubmitted;

  const updateRow = (index: number, patch: Partial<Row>, markDirty = true) => {
    if (markDirty) setIsDirty(true);
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

  // Timer requests in flight. The reconcile poll waits for them so it cannot
  // undo a start, pause or stop that this page has already made.
  const runTimerRequest = async (request: () => Promise<void>) => {
    pendingTimerRequests.current += 1;
    lastLocalTimerChange.current = Date.now();
    try {
      await request();
    } finally {
      pendingTimerRequests.current -= 1;
    }
  };

  // The row shows the timer straight away and is rolled back if the server
  // refuses it, so a second tab cannot start a timer at the same time.
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
    const accumulatedMs =
      (row.trackedSeconds ?? (rowMinutes(row) ?? 0) * 60) * 1000;
    const id = crypto.randomUUID();
    const shared: SharedActiveTimer = {
      id,
      logDate: date,
      task: row.task.trim(),
      client: row.client.trim() || null,
      category: row.category,
      startedAt: new Date(startedAt).toISOString(),
      accumulatedMs,
      running: true,
      source: "kazi",
      updatedAt: new Date(startedAt).toISOString(),
    };
    const timerRow: Row = {
      ...row,
      id,
      showRange: true,
      startTime: clockFromTimestamp(startedAt),
      endTime: "",
      minutes: "",
    };
    const timer: ActiveTimer = {
      id,
      rowId: id,
      date,
      running: true,
      startedAt,
      accumulatedMs: 0,
      source: "kazi",
      row: timerRow,
    };
    const replaceRow = (from: string, to: Row) =>
      setRows((current) =>
        current.map((item) => (item.id === from ? to : item)),
      );
    replaceRow(row.id, timerRow);
    cacheActiveTimer(timer);
    setActiveTimer(timer);
    setTimerNow(startedAt);

    void runTimerRequest(async () => {
      const response = await fetch("/api/pulse/daily-log/timer", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timer: shared }),
      }).catch(() => null);
      if (response?.ok) return;

      const json = (await response?.json().catch(() => null)) as {
        error?: string;
        timer?: SharedActiveTimer;
      } | null;
      replaceRow(id, row);
      cacheActiveTimer(null);
      setActiveTimer(null);
      if (json?.timer) {
        const serverTimer = activeTimerFromShared(json.timer);
        setRows((current) =>
          current.some((item) => item.id === serverTimer.rowId)
            ? current
            : [...current, serverTimer.row],
        );
        cacheActiveTimer(serverTimer);
        setActiveTimer(serverTimer);
      }
      toast.error(
        json?.error ??
          "Could not start the timer. Check your connection and try again.",
      );
    });
  };

  // Pause and resume go through the server so the extension and other tabs
  // see the same elapsed time.
  const toggleTimer = () => {
    if (!activeTimer) return;
    const timerId = activeTimer.id;
    const action = activeTimer.running ? "pause" : "resume";
    void runTimerRequest(async () => {
      const response = await fetch("/api/pulse/daily-log/timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, timerId }),
      }).catch(() => null);
      const json = (await response?.json().catch(() => null)) as {
        error?: string;
        timer?: SharedActiveTimer;
      } | null;
      if (!response?.ok || !json?.timer) {
        toast.error(json?.error ?? "Could not update the timer. Try again.");
        return;
      }
      setActiveTimer((current) => {
        if (!current || current.id !== timerId) return current;
        const next = mergeSharedTimer(current, json.timer!);
        cacheActiveTimer(next);
        return next;
      });
    });
  };

  // Stop is one server call that writes the day's single entry and clears the
  // timer. Retrying it is safe because the server answers with the stored entry.
  const stopTimer = () => {
    if (!activeTimer) return;
    const stopping = activeTimer;
    const stoppedAt = Date.now();
    const totalMs = timerElapsedMs(stopping, stoppedAt);
    cacheActiveTimer(null);
    setActiveTimer(null);
    // One toast with a fixed id: it shows "please wait" and is replaced by the outcome.
    const toastId = toast.loading("Please wait while we stop your timer…");

    void runTimerRequest(async () => {
      const response = await fetch("/api/pulse/daily-log/timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "stop",
          timerId: stopping.id,
          at: new Date(stoppedAt).toISOString(),
        }),
      }).catch(() => null);
      const json = (await response?.json().catch(() => null)) as {
        error?: string;
        entry?: DailyLogEntry | null;
        merged?: boolean;
        capped?: boolean;
        discarded?: boolean;
      } | null;
      if (!response?.ok) {
        // Still running on the server, so put the timer back.
        cacheActiveTimer(stopping);
        setActiveTimer(stopping);
        toast.error(
          json?.error ?? "Could not stop the timer. It is still running.",
          { id: toastId },
        );
        return;
      }
      if (json?.discarded) {
        toast.success(
          "Timer stopped. No time was added because this day is already full.",
          { id: toastId },
        );
        return;
      }
      const entry = json?.entry ?? {
        task: stopping.row.task,
        client: stopping.row.client || null,
        category: stopping.row.category,
        minutes: Math.max(1, Math.floor(totalMs / 60_000)),
      };
      const merged = json?.merged === true;
      setRows((current) =>
        applyStoppedEntry(current, stopping.rowId, entry, merged),
      );
      setIsDirty(true);
      toast.success(
        json?.capped
          ? "Timer stopped. Time was capped at the remaining capacity for that day."
          : `Timer stopped at ${formatElapsed(totalMs)}.`,
        { id: toastId },
      );
    });
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
    if (picked.length) setIsDirty(true);
  };

  const addRecurringWork = (entry: DailyLogEntry) => {
    setIsDirty(true);
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
    setIsDirty(true);
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

  const save = useCallback(async () => {
    if (activeTimer?.date === date) {
      toast.error("Stop the active timer before saving this daily log.");
      return;
    }
    if (needsRefresh) {
      toast.error(
        "Refresh this log before saving so the time logged in another window is kept.",
      );
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
        claimOutsideHours: Boolean(hasRange && row.claimOutsideHours),
        outsideHoursReason: row.outsideHoursReason.trim() || null,
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
      setIsDirty(false);
      const daysAfterSave = new Set(
        history
          .filter((log) => weekDays(date).some((day) => day.key === log.date))
          .filter((log) => log.entries.length > 0)
          .map((log) => log.date),
      );
      daysAfterSave.add(date);
      const completedAfterSave = weekDays(date).every((day) =>
        daysAfterSave.has(day.key),
      );
      if (completedAfterSave && !weeklyCheckinSubmitted) {
        toast.success("Your daily week is ready to review.");
        router.push(weeklyCheckinHref);
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
  }, [
    activeTimer,
    blockers,
    date,
    history,
    mood,
    needsRefresh,
    router,
    rows,
    weeklyCheckinSubmitted,
    weeklyCheckinHref,
    wins,
  ]);

  // A running timer lives on the server and follows the staff member around
  // Kazi. Only manual edits should interrupt navigation.
  const dailyLogNeedsAttention = !isReviewer && isDirty;

  const selectDate = (nextDate: string) => {
    if (nextDate === date) return;
    if (!confirmNavigation(() => setDate(nextDate))) return;
    setDate(nextDate);
  };

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    setUnsaved(dailyLogNeedsAttention, "Unsaved daily activity");
    return () => setUnsaved(false);
  }, [dailyLogNeedsAttention, setUnsaved]);

  useEffect(() => {
    setCallbacks({
      onSave: () => saveRef.current(),
      onDiscard: () => window.location.reload(),
    });
    return () => setCallbacks({});
  }, [setCallbacks]);

  const inputClass =
    "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60";
  const timeClass =
    "rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-hi)] outline-none focus:border-brand-500";

  return (
    <div className="space-y-6">
      <SetPageHeader
        title={isReviewer ? "Team activity" : "Daily log"}
        description={
          isReviewer
            ? "Review work logged by your team and follow up where support is needed."
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
                  className={`flex h-8 w-8 items-center justify-center rounded-xl ${weekComplete || weekShared ? "bg-emerald-500/10 text-emerald-600" : "bg-brand-500/10 text-brand-500"}`}
                >
                  <Icon
                    icon={
                      weekComplete || weekShared
                        ? "solar:check-circle-broken"
                        : "solar:calendar-mark-broken"
                    }
                    className="h-4 w-4"
                  />
                </span>
                <div>
                  <h2 className="text-md font-semibold text-[var(--text-hi)]">
                    {weekShared
                      ? "Your weekly report is shared"
                      : weekComplete
                        ? "Your week is ready to review"
                        : "This week's report"}
                  </h2>
                  <p className="mt-0.5 text-xs text-[var(--text-lo)]">
                    {weekShared
                      ? "Your weekly check-in is with your manager. Review daily activity whenever you need it."
                      : weekComplete
                        ? "Your daily work is shared. Add your reflection, then submit when you are ready."
                        : "Log work each day, then complete your reflection by Friday."}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-[var(--text-lo)]">
                <span
                  className={`font-semibold ${weekComplete || weekShared ? "text-emerald-600" : "text-brand-500"}`}
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
                href={weeklyCheckinHref}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-600"
              >
                <Icon
                  icon="solar:check-circle-broken"
                  className="h-3.5 w-3.5"
                />
                {weekShared
                  ? "View submitted check-in"
                  : weekComplete
                    ? "Complete weekly check-in"
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
                onChange={selectDate}
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
            activeTimer={
              activeTimer?.date === date
                ? {
                    task: activeTimer.row.task,
                    elapsed: formatElapsed(
                      timerElapsedMs(activeTimer, timerNow),
                    ),
                  }
                : null
            }
            onOpenTimer={() => setEditing(true)}
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
                  onChange={selectDate}
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
                  <div
                    key={row.id}
                    className="-mx-2 space-y-2 rounded-xl px-2 py-1 transition-colors duration-150 hover:bg-[var(--surface-2)]/60"
                  >
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
                                timerElapsedMs(activeTimer, timerNow),
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
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={toggleTimer}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-brand-500 hover:bg-brand-500/10"
                              aria-label={
                                activeTimer.running
                                  ? "Pause timer"
                                  : "Resume timer"
                              }
                              title={
                                activeTimer.running
                                  ? "Pause timer"
                                  : "Resume timer"
                              }
                            >
                              <Icon
                                icon={
                                  activeTimer.running
                                    ? "solar:pause-circle-broken"
                                    : "solar:play-circle-broken"
                                }
                                className="h-4 w-4"
                              />
                            </button>
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
                                timerElapsedMs(activeTimer, timerNow),
                              )}
                            </button>
                          </div>
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
                        <label className="ml-2 flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-[var(--text-lo)]">
                          <input
                            type="checkbox"
                            checked={row.claimOutsideHours}
                            disabled={activeTimer?.rowId === row.id}
                            onChange={(e) =>
                              updateRow(index, {
                                claimOutsideHours: e.target.checked,
                                ...(e.target.checked
                                  ? {}
                                  : { outsideHoursReason: "" }),
                              })
                            }
                            className="h-3.5 w-3.5 rounded border-[var(--border)] text-brand-500 focus:ring-brand-500"
                          />
                          Request outside-hours review
                        </label>
                        {row.claimOutsideHours ? (
                          <input
                            value={row.outsideHoursReason}
                            onChange={(e) =>
                              updateRow(index, {
                                outsideHoursReason: e.target.value,
                              })
                            }
                            maxLength={1000}
                            placeholder="Briefly explain why this time needs review"
                            className={`${timeClass} min-w-56 flex-1`}
                            aria-label="Outside-hours review reason"
                          />
                        ) : null}
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
                      onClick={() => {
                        setRows((prev) => [...prev, emptyRow()]);
                        setIsDirty(true);
                      }}
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

            <Accordion
              title="Daily reflection"
              subtitle="Mood, blockers and wins are optional"
              icon="solar:heart-pulse-broken"
              badge={mood ? MOOD_LABELS[mood - 1] : "Optional"}
              defaultOpen={Boolean(mood || blockers.trim() || wins.trim())}
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="mb-2 text-xs font-semibold text-[var(--text-hi)]">
                    How did today feel?
                  </p>
                  <div className="flex gap-1.5">
                    {MOODS.slice(0, DAILY_LOG_MOOD_COUNT).map(
                      (emoji, index) => {
                        const value = index + 1;
                        return (
                          <button
                            key={value}
                            type="button"
                            title={MOOD_LABELS[index]}
                            aria-label={`Mood ${value} of ${DAILY_LOG_MOOD_COUNT}: ${MOOD_LABELS[index]}`}
                            onClick={() => {
                              setMood(mood === value ? null : value);
                              setIsDirty(true);
                            }}
                            aria-pressed={mood === value}
                            className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg transition-colors ${mood === value ? "bg-brand-500/15 ring-2 ring-brand-500/40" : "bg-[var(--surface-2)] hover:bg-[var(--surface)]"}`}
                          >
                            {emoji}
                          </button>
                        );
                      },
                    )}
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
                    onChange={(e) => {
                      setBlockers(e.target.value);
                      setIsDirty(true);
                    }}
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
                    onChange={(e) => {
                      setWins(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="What went well, or what did you learn?"
                    maxLength={1000}
                    className={`${inputClass} resize-y`}
                  />
                </div>
              </div>
            </Accordion>

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

      {isReviewer && <TeamActivity reportId={reviewerReportId} />}
    </div>
  );
}
