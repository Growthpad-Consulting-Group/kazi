import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  extensionCors,
  extensionTokenUser,
} from "@/lib/browser-extension-auth";
import { awardDailyLogRewards } from "@/features/pulse/daily-log/rewards";
import {
  isEditableLogDate,
  validateDailyLogEntries,
  type DailyLogEntry,
} from "@/features/pulse/daily-log/constants";
import {
  mergeTimerEntry,
  parseSharedTimer,
  pauseSharedTimer,
  resumeSharedTimer,
  sharedTimerEntry,
  type SharedActiveTimer,
} from "@/features/pulse/daily-log/shared-timer";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- timer tables are newer than generated types.
const db = supabaseAdmin as any;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Owner = { userId: string; extension: boolean };

async function timerOwner(request: Request): Promise<Owner | null> {
  const session = await getServerSession(authOptions);
  if (session) return { userId: session.user.id, extension: false };
  const extension = await extensionTokenUser(request);
  return extension ? { userId: extension.user_id, extension: true } : null;
}

function respond(
  request: Request,
  owner: Owner | null,
  body: unknown,
  status = 200,
) {
  const response = NextResponse.json(body, { status });
  return owner?.extension ? extensionCors(request, response) : response;
}

export async function OPTIONS(request: Request) {
  return extensionCors(request, new NextResponse(null, { status: 204 }));
}

/**
 * Reads the active timer. When the caller passes the id of a timer it was
 * showing and that timer is gone, the response includes the entry written when
 * it was stopped, so the caller can show the duration without a reload.
 */
export async function GET(request: Request) {
  const owner = await timerOwner(request);
  if (!owner) return respond(request, null, { error: "Unauthorized" }, 401);
  const { data, error } = await db
    .from("shared_active_timers")
    .select("timer")
    .eq("user_id", owner.userId)
    .maybeSingle();
  if (error)
    return respond(request, owner, { error: "Could not load timer" }, 500);

  const stoppedTimerId = new URL(request.url).searchParams.get(
    "stoppedTimerId",
  );
  let stopped: DailyLogEntry | null = null;
  let merged = false;
  if (!data?.timer && stoppedTimerId && UUID_PATTERN.test(stoppedTimerId)) {
    const { data: claim } = await db
      .from("shared_timer_stops")
      .select("entry")
      .eq("user_id", owner.userId)
      .eq("timer_id", stoppedTimerId)
      .maybeSingle();
    stopped = claim ? storedStop(claim.entry).entry : null;
    merged = claim ? storedStop(claim.entry).merged : false;
  }
  return respond(request, owner, {
    timer: data?.timer ?? null,
    stopped,
    merged,
  });
}

/** Start a timer. Re-sending the same timer id is an idempotent update. */
export async function PUT(request: Request) {
  const owner = await timerOwner(request);
  if (!owner) return respond(request, null, { error: "Unauthorized" }, 401);
  const body = (await request.json().catch(() => null)) as {
    timer?: unknown;
  } | null;
  const parsed = parseSharedTimer(body?.timer);
  if (!parsed.ok) return respond(request, owner, { error: parsed.error }, 400);
  const { timer } = parsed;

  const { data: stopped } = await db
    .from("shared_timer_stops")
    .select("timer_id")
    .eq("user_id", owner.userId)
    .eq("timer_id", timer.id)
    .maybeSingle();
  if (stopped)
    return respond(
      request,
      owner,
      { error: "This timer was already stopped" },
      409,
    );

  const { data: current, error: readError } = await db
    .from("shared_active_timers")
    .select("timer_id, timer")
    .eq("user_id", owner.userId)
    .maybeSingle();
  if (readError)
    return respond(request, owner, { error: "Could not save timer" }, 500);

  if (current && current.timer_id !== timer.id)
    return respond(
      request,
      owner,
      { error: "A timer is already active", timer: current.timer },
      409,
    );

  const row = {
    user_id: owner.userId,
    timer_id: timer.id,
    log_date: timer.logDate,
    timer,
    updated_at: timer.updatedAt,
  };
  // Inserting for a brand-new timer lets the primary key reject a second
  // tab that started at the same moment.
  const { error } = current
    ? await db
        .from("shared_active_timers")
        .update(row)
        .eq("user_id", owner.userId)
        .eq("timer_id", timer.id)
    : await db.from("shared_active_timers").insert(row);
  if (error?.code === "23505")
    return respond(request, owner, { error: "A timer is already active" }, 409);
  if (error)
    return respond(request, owner, { error: "Could not save timer" }, 500);
  return respond(request, owner, { timer });
}

/** Pause, resume or stop the timer with the given id. */
export async function POST(request: Request) {
  const owner = await timerOwner(request);
  if (!owner) return respond(request, null, { error: "Unauthorized" }, 401);
  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
    timerId?: unknown;
    at?: unknown;
  } | null;
  const action = body?.action;
  if (
    !["pause", "resume", "stop"].includes(String(action)) ||
    typeof body?.timerId !== "string" ||
    !UUID_PATTERN.test(body.timerId)
  )
    return respond(
      request,
      owner,
      { error: "A timer action and timer id are required" },
      400,
    );

  if (action === "stop")
    return stopTimer(request, owner, body.timerId, body.at);

  const { data: row, error: readError } = await db
    .from("shared_active_timers")
    .select("timer")
    .eq("user_id", owner.userId)
    .eq("timer_id", body.timerId)
    .maybeSingle();
  if (readError)
    return respond(request, owner, { error: "Could not update timer" }, 500);
  if (!row) return respond(request, owner, { error: "No active timer" }, 404);

  const current = row.timer as SharedActiveTimer;
  const next =
    action === "pause" ? pauseSharedTimer(current) : resumeSharedTimer(current);
  if (next === current || next.running === current.running)
    return respond(request, owner, { timer: current });

  const { error } = await db
    .from("shared_active_timers")
    .update({ timer: next, updated_at: next.updatedAt })
    .eq("user_id", owner.userId)
    .eq("timer_id", body.timerId);
  if (error)
    return respond(request, owner, { error: "Could not update timer" }, 500);
  return respond(request, owner, { timer: next });
}

/**
 * Stop is idempotent per timer id. The claim row is inserted before the daily
 * log is written, so a retry or a second tab reads the stored entry instead
 * of logging the time twice.
 */
/**
 * Claims are stored as { entry, merged }. Older claims hold the bare entry.
 */
function storedStop(stored: unknown): {
  entry: DailyLogEntry | null;
  merged: boolean;
} {
  const value = stored as { entry?: DailyLogEntry | null; merged?: boolean };
  if (value && typeof value.entry === "object")
    return { entry: value.entry, merged: value.merged === true };
  if (value?.entry === null) return { entry: null, merged: false };
  return { entry: stored as DailyLogEntry, merged: false };
}

async function stopTimer(
  request: Request,
  owner: Owner,
  timerId: string,
  at: unknown,
) {
  const { data: row, error: readError } = await db
    .from("shared_active_timers")
    .select("log_date, timer")
    .eq("user_id", owner.userId)
    .eq("timer_id", timerId)
    .maybeSingle();
  if (readError)
    return respond(request, owner, { error: "Could not stop timer" }, 500);

  if (!row) {
    const { data: claim } = await db
      .from("shared_timer_stops")
      .select("entry")
      .eq("user_id", owner.userId)
      .eq("timer_id", timerId)
      .maybeSingle();
    if (claim) {
      const stored = storedStop(claim.entry);
      return respond(request, owner, {
        entry: stored.entry,
        merged: stored.merged,
        timer: null,
        duplicate: true,
      });
    }
    return respond(request, owner, { error: "No active timer" }, 404);
  }

  if (!isEditableLogDate(row.log_date))
    return respond(
      request,
      owner,
      { error: "This timer's day is locked and can no longer be logged." },
      403,
    );

  const timer = row.timer as SharedActiveTimer;
  const stoppedAt = stopInstant(timer, at);
  const session = sharedTimerEntry(timer, stoppedAt);
  const existing = await loadDailyEntries(owner.userId, row.log_date);
  if (!existing.ok)
    return respond(request, owner, { error: existing.error }, 500);
  const usedMinutes = existing.entries.reduce(
    (total, entry) => total + entry.minutes,
    0,
  );
  const availableMinutes = Math.max(0, 24 * 60 - usedMinutes);
  const capped = session.minutes > availableMinutes;

  // A timer left running overnight must never become impossible to stop. Keep
  // the time that fits the start day's remaining capacity; if the day is
  // already full, close the timer without adding another invalid entry.
  if (availableMinutes === 0) {
    const cleared = await claimAndClearTimer({
      owner,
      timerId,
      logDate: row.log_date,
      stoppedAt,
      entry: null,
      merged: false,
    });
    if (!cleared.ok)
      return respond(request, owner, { error: "Could not stop timer" }, 500);
    return respond(request, owner, {
      entry: null,
      merged: false,
      timer: null,
      capped: true,
      discarded: true,
    });
  }
  const entryToMerge = capped
    ? { ...session, minutes: availableMinutes }
    : session;
  const { entries, resulting, merged } = mergeTimerEntry(
    existing.entries,
    entryToMerge,
  );
  const validated = validateDailyLogEntries(entries);
  if (!validated.ok)
    return respond(request, owner, { error: validated.error }, 400);

  const { error: claimError } = await db.from("shared_timer_stops").insert({
    user_id: owner.userId,
    timer_id: timerId,
    log_date: row.log_date,
    entry: { entry: resulting, merged },
    stopped_at: stoppedAt.toISOString(),
  });
  if (claimError?.code === "23505") {
    const { data: claim } = await db
      .from("shared_timer_stops")
      .select("entry")
      .eq("user_id", owner.userId)
      .eq("timer_id", timerId)
      .maybeSingle();
    const stored = storedStop(claim?.entry ?? { entry: resulting, merged });
    return respond(request, owner, {
      entry: stored.entry,
      merged: stored.merged,
      timer: null,
      duplicate: true,
    });
  }
  if (claimError)
    return respond(request, owner, { error: "Could not stop timer" }, 500);

  const written = await writeDailyEntries(
    owner.userId,
    row.log_date,
    validated.entries,
  );
  if (!written.ok) {
    await db
      .from("shared_timer_stops")
      .delete()
      .eq("user_id", owner.userId)
      .eq("timer_id", timerId);
    return respond(request, owner, { error: written.error }, 500);
  }

  // Rewards must never undo a saved entry.
  try {
    await awardDailyLogRewards(owner.userId, row.log_date, validated.entries);
  } catch (rewardError) {
    console.error("Daily log rewards failed", rewardError);
  }

  // Clearing the timer is the last step. If it fails, a retry finds the claim
  // above and only clears the timer again.
  await db
    .from("shared_active_timers")
    .delete()
    .eq("user_id", owner.userId)
    .eq("timer_id", timerId);

  return respond(request, owner, {
    entry: resulting,
    merged,
    timer: null,
    capped,
  });
}

async function claimAndClearTimer({
  owner,
  timerId,
  logDate,
  stoppedAt,
  entry,
  merged,
}: {
  owner: Owner;
  timerId: string;
  logDate: string;
  stoppedAt: Date;
  entry: DailyLogEntry | null;
  merged: boolean;
}): Promise<{ ok: true } | { ok: false }> {
  const { error: claimError } = await db.from("shared_timer_stops").insert({
    user_id: owner.userId,
    timer_id: timerId,
    log_date: logDate,
    entry: { entry, merged },
    stopped_at: stoppedAt.toISOString(),
  });
  // Another tab may have claimed the same stop. Clearing again is safe and
  // recovers the rare case where its final delete was interrupted.
  if (claimError?.code === "23505") {
    const { error: deleteError } = await db
      .from("shared_active_timers")
      .delete()
      .eq("user_id", owner.userId)
      .eq("timer_id", timerId);
    return deleteError ? { ok: false } : { ok: true };
  }
  if (claimError) return { ok: false };
  const { error: deleteError } = await db
    .from("shared_active_timers")
    .delete()
    .eq("user_id", owner.userId)
    .eq("timer_id", timerId);
  return deleteError ? { ok: false } : { ok: true };
}

/** Clamp a client-reported stop time so it cannot precede the start or lie in the future. */
function stopInstant(timer: SharedActiveTimer, at: unknown): Date {
  const now = new Date();
  if (typeof at !== "string") return now;
  const requested = new Date(at);
  if (Number.isNaN(requested.getTime())) return now;
  if (timer.running && timer.startedAt) {
    const startedAt = new Date(timer.startedAt);
    if (requested < startedAt) return startedAt;
  }
  return requested > now ? now : requested;
}

async function loadDailyEntries(
  userId: string,
  date: string,
): Promise<
  { ok: true; entries: DailyLogEntry[] } | { ok: false; error: string }
> {
  const { data, error } = await db
    .from("daily_activity_logs")
    .select("entries")
    .eq("user_id", userId)
    .eq("log_date", date)
    .maybeSingle();
  if (error) return { ok: false, error: "Could not load daily log" };
  return { ok: true, entries: (data?.entries ?? []) as DailyLogEntry[] };
}

async function writeDailyEntries(
  userId: string,
  date: string,
  entries: DailyLogEntry[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await db
    .from("daily_activity_logs")
    .upsert(
      { user_id: userId, log_date: date, entries },
      { onConflict: "user_id,log_date" },
    );
  if (error) return { ok: false, error: "Could not save daily log" };
  return { ok: true };
}
