import { supabaseAdmin } from "@/lib/supabase";
import { loadAsanaTaskHealth } from "@/lib/asana-task-health";
import {
  loadManagerAttention,
  type ReportCheckin,
} from "@/features/pulse/dashboard/manager-queue-data";
import {
  deliverSlackNotification,
  postSlackChannelNotification,
} from "@/lib/slack";
import {
  addDays,
  clockLabel,
  clockToMinutes,
  inCatchUpWindow,
  isInQuietHours,
  localClock,
  weekStartOf,
  type LocalClock,
} from "@/lib/slack-schedule";
import {
  buildCheckinNudge,
  buildCheckinReviewReminder,
  buildDailyBrief,
  buildInterviewReminder,
  buildHallOfFameClosingReminder,
  buildManagerMondayPulse,
  buildManagerReviewQueue,
  buildOneOnOneFollowUp,
  buildOneOnOneReminder,
  buildPublicRecognitionMessage,
  buildReviewAcknowledgementReminder,
  buildTimerRunningReminder,
} from "@/lib/slack-digests";
import { buildCultureRecap } from "@/lib/culture-recap";

const DEFAULT_TIMEZONE = "Africa/Nairobi";
const WINDOW_MINUTES = 60;
const QUIET_HOURS_CATCH_UP_MINUTES = 4 * 60;
const CHECKIN_NUDGE_START = 12 * 60; // Friday, 12:00 local
const MANAGER_REVIEW_START = 16 * 60; // Friday, 16:00 local
const REMINDER_LEAD_MINUTES = 90;
const FOLLOW_UP_MIN_AGE_MINUTES = 60;
const FOLLOW_UP_MAX_AGE_MINUTES = 180;
const WORKING_DAYS_DEFAULT = [1, 2, 3, 4, 5];
const TIMER_REMINDER_HOURS = 8;
const TIMER_URGENT_REMINDER_HOURS = 20;

export type DigestCounts = {
  delivered: number;
  suppressed: number;
  failed: number;
  dailyBriefs: number;
  checkinNudges: number;
  managerPulses: number;
  reviewQueues: number;
  oneOnOneReminders: number;
  oneOnOneFollowUps: number;
  interviewReminders: number;
  overdueScorecards: number;
  reviewAcknowledgementReminders: number;
  hallOfFameReminders: number;
  cultureRecaps: number;
  cultureAnnouncements: number;
  timerReminders: number;
  snoozedReminders: number;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  manager_id: string | null;
};
type PrefRow = {
  user_id: string;
  slack_enabled: boolean;
  slack_quiet_start: string | null;
  slack_quiet_end: string | null;
  slack_timezone: string | null;
  slack_daily_brief: boolean;
  culture_announcements: boolean | null;
};
type ScheduleRow = {
  user_id: string;
  timezone: string;
  workday_start: string;
  working_days: number[];
};

// Tables outside the generated types are read through `any`, like the rest of the app.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed tables
const db = supabaseAdmin as any;

function emptyCounts(): DigestCounts {
  return {
    delivered: 0,
    suppressed: 0,
    failed: 0,
    dailyBriefs: 0,
    checkinNudges: 0,
    managerPulses: 0,
    reviewQueues: 0,
    oneOnOneReminders: 0,
    oneOnOneFollowUps: 0,
    interviewReminders: 0,
    overdueScorecards: 0,
    reviewAcknowledgementReminders: 0,
    hallOfFameReminders: 0,
    cultureRecaps: 0,
    cultureAnnouncements: 0,
    timerReminders: 0,
    snoozedReminders: 0,
  };
}

function record(
  counts: DigestCounts,
  outcome: "delivered" | "suppressed" | "failed",
) {
  counts[outcome] += 1;
}

/**
 * Runs every scheduled Slack digest that is due at `now`. Each job is keyed
 * by event, so reruns or overlapping hourly runs send at most one message.
 * Messages carry counts or a single link, never private narrative.
 *
 * Throws when preferences cannot be read: sending without knowing quiet hours
 * and opt-ins would be worse than sending nothing.
 */
export async function runSlackDigests(
  now: Date = new Date(),
): Promise<DigestCounts> {
  const counts = emptyCounts();

  const [usersRes, prefsRes, schedulesRes] = await Promise.all([
    supabaseAdmin
      .from("users")
      .select("id, name, email, role, manager_id")
      .eq("is_active", true),
    db
      .from("user_notification_preferences")
      .select(
        "user_id, slack_enabled, slack_quiet_start, slack_quiet_end, slack_timezone, slack_daily_brief, culture_announcements",
      ),
    db
      .from("staff_work_schedules")
      .select("user_id, timezone, workday_start, working_days"),
  ]);
  if (usersRes.error) throw new Error("Active staff could not be loaded");
  if (prefsRes.error) throw new Error("Slack preferences could not be loaded");

  // When an Asana-to-Slack rule already sends task reminders, the brief leaves
  // Asana counts out. If the setting cannot be read, nothing is sent.
  const settingsRes = await db
    .from("company_settings")
    .select("asana_slack_rules_enabled")
    .eq("id", "default")
    .maybeSingle();
  if (settingsRes.error)
    throw new Error("Company settings could not be loaded");
  const asanaRulesOn = settingsRes.data?.asana_slack_rules_enabled === true;
  // Staff who turned off Asana counts in Settings never receive them in the brief.
  const { data: asanaRows } = await db
    .from("asana_connections")
    .select("user_id, include_in_slack_brief");
  const asanaOptOut = new Set(
    (
      (asanaRows ?? []) as {
        user_id: string;
        include_in_slack_brief: boolean | null;
      }[]
    )
      .filter((row) => row.include_in_slack_brief === false)
      .map((row) => row.user_id),
  );

  const users = (usersRes.data ?? []) as UserRow[];
  const byId = new Map(users.map((user) => [user.id, user]));
  const prefs = new Map(
    ((prefsRes.data ?? []) as PrefRow[]).map((row) => [row.user_id, row]),
  );
  const schedules = new Map(
    ((schedulesRes.data ?? []) as ScheduleRow[]).map((row) => [
      row.user_id,
      row,
    ]),
  );
  const reportsByManager = new Map<string, string[]>();
  for (const user of users) {
    if (!user.manager_id) continue;
    reportsByManager.set(user.manager_id, [
      ...(reportsByManager.get(user.manager_id) ?? []),
      user.id,
    ]);
  }

  for (const user of users) {
    const pref = prefs.get(user.id);
    if (pref && pref.slack_enabled === false) continue;
    const schedule = schedules.get(user.id);
    const timezone =
      schedule?.timezone ?? pref?.slack_timezone ?? DEFAULT_TIMEZONE;
    const clock = localClock(now, timezone);
    const quiet = isInQuietHours(
      pref?.slack_quiet_start ?? null,
      pref?.slack_quiet_end ?? null,
      pref?.slack_timezone ?? DEFAULT_TIMEZONE,
      now,
    );
    if (quiet) continue; // Skipped without a delivery record, so a later run can still send.

    const weekStart = weekStartOf(clock.date, clock.weekday);
    const startMinutes = clockToMinutes(schedule?.workday_start, "08:00");
    const workingDays = schedule?.working_days ?? WORKING_DAYS_DEFAULT;

    if (
      pref?.slack_daily_brief === true &&
      workingDays.includes(clock.weekday) &&
      inCatchUpWindow(
        clock,
        startMinutes,
        WINDOW_MINUTES,
        QUIET_HOURS_CATCH_UP_MINUTES,
      )
    ) {
      await sendDailyBrief(
        user,
        byId,
        clock,
        timezone,
        now,
        weekStart,
        counts,
        asanaRulesOn || asanaOptOut.has(user.id),
      );
    }

    if (
      clock.weekday === 5 &&
      inCatchUpWindow(
        clock,
        CHECKIN_NUDGE_START,
        WINDOW_MINUTES,
        QUIET_HOURS_CATCH_UP_MINUTES,
      )
    ) {
      await sendCheckinNudge(user, clock, weekStart, counts);
    }

    // Released review results stay visible until acknowledged, so nudge on
    // Monday and Thursday mornings. The reminder stops once acknowledged.
    if (
      (clock.weekday === 1 || clock.weekday === 4) &&
      inCatchUpWindow(
        clock,
        startMinutes,
        WINDOW_MINUTES,
        QUIET_HOURS_CATCH_UP_MINUTES,
      )
    ) {
      await sendReviewAcknowledgementReminder(user, clock, counts);
    }

    const reports = reportsByManager.get(user.id) ?? [];
    if (reports.length) {
      if (
        clock.weekday === 1 &&
        inCatchUpWindow(
          clock,
          startMinutes,
          WINDOW_MINUTES,
          QUIET_HOURS_CATCH_UP_MINUTES,
        )
      )
        await sendManagerPulse(
          user,
          byId,
          reports,
          weekStart,
          clock.date,
          counts,
        );
      if (
        clock.weekday === 5 &&
        inCatchUpWindow(
          clock,
          MANAGER_REVIEW_START,
          WINDOW_MINUTES,
          QUIET_HOURS_CATCH_UP_MINUTES,
        )
      )
        await sendReviewQueue(user, reports, weekStart, counts);
    }
  }

  await sendOneOnOneReminders(now, byId, prefs, counts);
  await sendOneOnOneFollowUps(now, byId, prefs, counts);
  await sendInterviewReminders(now, byId, prefs, counts);
  await sendOverdueScorecardReminders(now, byId, prefs, counts);
  await sendHallOfFameClosingReminder(now, counts);
  await sendLongRunningTimerReminders(now, byId, prefs, counts);
  await sendDueSnoozedReminders(now, counts);
  await publishCultureAnnouncements(now, byId, prefs, counts);
  await sendWeeklyCultureRecap(now, byId, prefs, counts);
  return counts;
}

type SharedTimerRow = {
  user_id: string;
  timer_id: string;
  timer: {
    task?: string;
    running?: boolean;
    startedAt?: string | null;
    accumulatedMs?: number;
  };
};

/**
 * A running timer is private work data, so this is intentionally a DM to its
 * owner only. A normal check-in at eight hours and an urgent check at twenty
 * hours make an accidental overnight timer recoverable before the daily limit.
 */
async function sendLongRunningTimerReminders(
  now: Date,
  byId: Map<string, UserRow>,
  prefs: Map<string, PrefRow>,
  counts: DigestCounts,
) {
  const { data, error } = await db
    .from("shared_active_timers")
    .select("user_id,timer_id,timer");
  if (error) {
    console.error("Could not load active timers for Slack reminders", error);
    return;
  }

  for (const row of (data ?? []) as SharedTimerRow[]) {
    const timer = row.timer;
    if (!timer?.running || !timer.startedAt || !byId.has(row.user_id)) continue;
    const preference = prefs.get(row.user_id);
    if (preference?.slack_enabled === false) continue;
    // Do not reserve the once-per-timer delivery while the owner is in quiet
    // hours. A later hourly run can send it when their local quiet window ends.
    if (
      isInQuietHours(
        preference?.slack_quiet_start ?? null,
        preference?.slack_quiet_end ?? null,
        preference?.slack_timezone ?? DEFAULT_TIMEZONE,
        now,
      )
    )
      continue;
    const startedAt = new Date(timer.startedAt).getTime();
    if (Number.isNaN(startedAt)) continue;
    const elapsedMs = Math.max(
      0,
      (timer.accumulatedMs ?? 0) + now.getTime() - startedAt,
    );
    const elapsedHours = Math.floor(elapsedMs / 3_600_000);
    if (elapsedHours < TIMER_REMINDER_HOURS) continue;
    const urgent = elapsedHours >= TIMER_URGENT_REMINDER_HOURS;
    const message = buildTimerRunningReminder({
      task: timer.task?.trim() || "your current activity",
      elapsedHours,
      urgent,
      appUrl: appUrl(),
    });
    const outcome = await deliverSlackNotification({
      eventKey: `timer-running-${urgent ? "urgent" : "check"}:${row.timer_id}`,
      recipientUserId: row.user_id,
      category: "timer_reminder",
      text: message.text,
      blocks: message.blocks,
      digest: true,
    });
    record(counts, outcome);
    if (outcome === "delivered") counts.timerReminders += 1;
  }
}

async function sendDailyBrief(
  user: UserRow,
  byId: Map<string, UserRow>,
  clock: LocalClock,
  timezone: string,
  now: Date,
  weekStart: string,
  counts: DigestCounts,
  asanaRulesOn: boolean,
) {
  const dayStart = new Date(now.getTime() - 36 * 3_600_000).toISOString();
  const dayEnd = new Date(now.getTime() + 36 * 3_600_000).toISOString();
  const dueBy = addDays(clock.date, 3);

  const [meetings, goals, log, checkin] = await Promise.all([
    supabaseAdmin
      .from("one_on_ones")
      .select("manager_id, report_id, scheduled_at")
      .or(`manager_id.eq.${user.id},report_id.eq.${user.id}`)
      .gte("scheduled_at", dayStart)
      .lte("scheduled_at", dayEnd),
    supabaseAdmin
      .from("goals")
      .select("id")
      .eq("owner_id", user.id)
      .not("status", "in", "(completed,cancelled)")
      .gte("due_date", clock.date)
      .lte("due_date", dueBy),
    db
      .from("daily_activity_logs")
      .select("entries")
      .eq("user_id", user.id)
      .eq("log_date", clock.date)
      .maybeSingle(),
    supabaseAdmin
      .from("checkins")
      .select("status")
      .eq("user_id", user.id)
      .eq("week_start", weekStart)
      .maybeSingle(),
  ]);

  const todays = (
    (meetings.data ?? []) as {
      manager_id: string;
      report_id: string;
      scheduled_at: string;
    }[]
  ).filter(
    (meeting) =>
      localClock(new Date(meeting.scheduled_at), timezone).date === clock.date,
  );
  const meetingLines = todays.map((meeting) => {
    const otherId =
      meeting.manager_id === user.id ? meeting.report_id : meeting.manager_id;
    return {
      withName: byId.get(otherId)?.name ?? "a colleague",
      time: clockLabel(new Date(meeting.scheduled_at), timezone),
    };
  });

  // Asana is optional: when it is not connected or fails, the brief still goes out.
  const asana = asanaRulesOn
    ? { connected: false as const }
    : await loadAsanaTaskHealth({
        userId: user.id,
        today: clock.date,
      }).catch(() => ({ connected: false as const }));

  const entries = (log.data?.entries ?? []) as unknown[];
  const message = buildDailyBrief({
    firstName: user.name.split(" ")[0] || "there",
    meetings: meetingLines,
    goalsDueSoon: goals.data?.length ?? 0,
    logMissing: entries.length === 0,
    checkinPending: !["submitted", "reviewed"].includes(
      checkin.data?.status ?? "",
    ),
    asanaDueToday: asana.connected ? asana.health.dueToday.length : 0,
    asanaOverdue: asana.connected ? asana.health.overdue.length : 0,
    appUrl: appUrl(),
  });
  if (!message) return;

  const outcome = await deliverSlackNotification({
    eventKey: `daily-brief:${user.id}:${clock.date}`,
    recipientUserId: user.id,
    category: "daily_brief",
    text: message.text,
    blocks: message.blocks,
    digest: true,
  });
  record(counts, outcome);
  if (outcome === "delivered") counts.dailyBriefs += 1;
}

async function sendCheckinNudge(
  user: UserRow,
  clock: LocalClock,
  weekStart: string,
  counts: DigestCounts,
) {
  const { data } = await supabaseAdmin
    .from("checkins")
    .select("status")
    .eq("user_id", user.id)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (["submitted", "reviewed"].includes(data?.status ?? "")) return;

  const outcome = await deliverSlackNotification({
    eventKey: `checkin-nudge:${user.id}:${weekStart}`,
    recipientUserId: user.id,
    category: "checkin_reminder",
    text: "Your weekly reflection is still open.",
    blocks: buildCheckinNudge(appUrl()).blocks,
    digest: true,
  });
  record(counts, outcome);
  if (outcome === "delivered") counts.checkinNudges += 1;
}

/** Released results the person has not acknowledged, excluding reviews they wrote. */
async function outstandingReviewAcknowledgements(userId: string) {
  // Only results that have been released and that the employee has not acknowledged.
  const { data } = await db
    .from("performance_reviews")
    .select("id, reviewer_id, review_cycles!inner(results_released_at)")
    .eq("reviewee_id", userId)
    .is("employee_acknowledged_at", null)
    .not("review_cycles.results_released_at", "is", null);
  const open = ((data ?? []) as { id: string; reviewer_id: string }[]).filter(
    (review) => review.reviewer_id !== userId,
  );
  return {
    outstanding: open.length,
    singleReviewId: open.length === 1 ? open[0].id : null,
  };
}

async function sendReviewAcknowledgementReminder(
  user: UserRow,
  clock: LocalClock,
  counts: DigestCounts,
) {
  const { outstanding, singleReviewId } =
    await outstandingReviewAcknowledgements(user.id);
  const message = buildReviewAcknowledgementReminder({
    outstanding,
    singleReviewId,
    appUrl: appUrl(),
  });
  if (!message) return;

  const outcome = await deliverSlackNotification({
    eventKey: `review-ack:${user.id}:${clock.date}`,
    recipientUserId: user.id,
    category: "review_open",
    text: message.text,
    blocks: message.blocks,
    digest: true,
  });
  record(counts, outcome);
  if (outcome === "delivered") counts.reviewAcknowledgementReminders += 1;
}

async function sendManagerPulse(
  manager: UserRow,
  byId: Map<string, UserRow>,
  reports: string[],
  weekStart: string,
  today: string,
  counts: DigestCounts,
) {
  const { data } = await supabaseAdmin
    .from("checkins")
    .select("user_id, status, mood, blockers")
    .in("user_id", reports)
    .eq("week_start", weekStart);
  const rows = (data ?? []) as {
    user_id: string;
    status: string;
    mood: number | null;
    blockers: string | null;
  }[];
  const submitted = new Set(
    rows
      .filter((row) => ["submitted", "reviewed"].includes(row.status))
      .map((row) => row.user_id),
  );
  const flagged = rows.filter(
    (row) =>
      Boolean(row.blockers?.trim()) || (row.mood !== null && row.mood <= 2),
  ).length;
  // The manager's own queue, reduced to counts. Names and blocker text stay in
  // Kazi: the flagged and check-in items are already covered by this message.
  const attention = await loadManagerAttention({
    userId: manager.id,
    role: manager.role as Parameters<typeof loadManagerAttention>[0]["role"],
    reportIds: reports,
    teamCheckins: rows.map((row) => ({
      user_id: row.user_id,
      name: byId.get(row.user_id)?.name ?? "A team member",
      status: row.status as ReportCheckin["status"],
      mood: row.mood,
      blockers: row.blockers,
    })),
  }).catch(() => []);
  const queueLines = attention
    .filter(
      (item) => !["flagged_team_member", "checkin_review"].includes(item.id),
    )
    .map((item) => item.title);

  // Only team members who chose to share get an Asana count, and only as a number.
  const { data: sharing } = await db
    .from("asana_connections")
    .select("user_id")
    .in("user_id", reports)
    .eq("share_task_health_with_manager", true);
  let asanaOverdue = 0;
  let sharers = 0;
  for (const row of (sharing ?? []) as { user_id: string }[]) {
    const health = await loadAsanaTaskHealth({
      userId: row.user_id,
      today,
    }).catch(() => ({ connected: false as const }));
    if (!health.connected || health.health.overdue.length === 0) continue;
    sharers += 1;
    asanaOverdue += health.health.overdue.length;
  }
  if (asanaOverdue > 0)
    queueLines.push(
      `${asanaOverdue} overdue Asana ${asanaOverdue === 1 ? "task" : "tasks"} across ${sharers} ${sharers === 1 ? "person" : "people"} who shared their count`,
    );

  const message = buildManagerMondayPulse({
    missingCheckins: reports.filter((id) => !submitted.has(id)).length,
    flagged,
    queueLines,
    appUrl: appUrl(),
  });
  if (!message) return;

  const outcome = await deliverSlackNotification({
    eventKey: `manager-pulse:${manager.id}:${weekStart}`,
    recipientUserId: manager.id,
    category: "checkin_submitted",
    text: message.text,
    blocks: message.blocks,
    digest: true,
  });
  record(counts, outcome);
  if (outcome === "delivered") counts.managerPulses += 1;
}

async function sendReviewQueue(
  manager: UserRow,
  reports: string[],
  weekStart: string,
  counts: DigestCounts,
) {
  const { count } = await supabaseAdmin
    .from("checkins")
    .select("id", { count: "exact", head: true })
    .in("user_id", reports)
    .eq("week_start", weekStart)
    .eq("status", "submitted");
  const message = buildManagerReviewQueue({
    awaitingReview: count ?? 0,
    appUrl: appUrl(),
  });
  if (!message) return;

  const outcome = await deliverSlackNotification({
    eventKey: `manager-review-queue:${manager.id}:${weekStart}`,
    recipientUserId: manager.id,
    category: "checkin_submitted",
    text: message.text,
    blocks: message.blocks,
    digest: true,
  });
  record(counts, outcome);
  if (outcome === "delivered") counts.reviewQueues += 1;
}

async function sendOneOnOneReminders(
  now: Date,
  byId: Map<string, UserRow>,
  prefs: Map<string, PrefRow>,
  counts: DigestCounts,
) {
  const until = new Date(
    now.getTime() + REMINDER_LEAD_MINUTES * 60_000,
  ).toISOString();
  const { data } = await supabaseAdmin
    .from("one_on_ones")
    .select("id, manager_id, report_id, scheduled_at, google_event_id")
    .gt("scheduled_at", now.toISOString())
    .lte("scheduled_at", until);

  for (const meeting of (data ?? []) as {
    id: string;
    manager_id: string;
    report_id: string;
    scheduled_at: string;
    google_event_id: string | null;
  }[]) {
    // A calendar invitation already reaches both participants with its own
    // reminder. Slack adds a reminder only for meetings without an invite.
    if (meeting.google_event_id) continue;
    for (const [recipient, other] of [
      [meeting.manager_id, meeting.report_id],
      [meeting.report_id, meeting.manager_id],
    ] as const) {
      const person = byId.get(recipient);
      const otherPerson = byId.get(other);
      if (!person || !otherPerson) continue;
      const pref = prefs.get(recipient);
      if (pref?.slack_enabled === false) continue;
      if (
        isInQuietHours(
          pref?.slack_quiet_start ?? null,
          pref?.slack_quiet_end ?? null,
          pref?.slack_timezone ?? DEFAULT_TIMEZONE,
          now,
        )
      )
        continue;
      const timezone = pref?.slack_timezone ?? DEFAULT_TIMEZONE;
      const message = buildOneOnOneReminder({
        withName: otherPerson.name,
        time: clockLabel(new Date(meeting.scheduled_at), timezone),
        appUrl: appUrl(),
      });
      const outcome = await deliverSlackNotification({
        eventKey: `one-on-one-reminder:${meeting.id}:${meeting.scheduled_at}:${recipient}`,
        recipientUserId: recipient,
        category: "one_on_one_reminder",
        text: message.text,
        blocks: message.blocks,
        digest: true,
      });
      record(counts, outcome);
      if (outcome === "delivered") counts.oneOnOneReminders += 1;
    }
  }
}

async function sendOneOnOneFollowUps(
  now: Date,
  byId: Map<string, UserRow>,
  prefs: Map<string, PrefRow>,
  counts: DigestCounts,
) {
  const from = new Date(
    now.getTime() - FOLLOW_UP_MAX_AGE_MINUTES * 60_000,
  ).toISOString();
  const to = new Date(
    now.getTime() - FOLLOW_UP_MIN_AGE_MINUTES * 60_000,
  ).toISOString();
  const { data } = await supabaseAdmin
    .from("one_on_ones")
    .select("id, manager_id, report_id, notes, action_items, scheduled_at")
    .gte("scheduled_at", from)
    .lte("scheduled_at", to);

  for (const meeting of (data ?? []) as {
    id: string;
    manager_id: string;
    report_id: string;
    notes: string | null;
    action_items: unknown[] | null;
  }[]) {
    // Only the manager, who owns the notes, is asked to complete them.
    const hasNotes = Boolean(meeting.notes?.trim());
    const hasActions =
      Array.isArray(meeting.action_items) && meeting.action_items.length > 0;
    if (hasNotes || hasActions) continue;
    const manager = byId.get(meeting.manager_id);
    const report = byId.get(meeting.report_id);
    if (!manager || !report) continue;
    const pref = prefs.get(manager.id);
    if (pref?.slack_enabled === false) continue;
    if (
      isInQuietHours(
        pref?.slack_quiet_start ?? null,
        pref?.slack_quiet_end ?? null,
        pref?.slack_timezone ?? DEFAULT_TIMEZONE,
        now,
      )
    )
      continue;
    const message = buildOneOnOneFollowUp({
      withName: report.name,
      appUrl: appUrl(),
      meetingId: meeting.id,
    });
    const outcome = await deliverSlackNotification({
      eventKey: `one-on-one-followup:${meeting.id}:${manager.id}`,
      recipientUserId: manager.id,
      category: "one_on_one_reminder",
      text: message.text,
      blocks: message.blocks,
      digest: true,
    });
    record(counts, outcome);
    if (outcome === "delivered") counts.oneOnOneFollowUps += 1;
  }
}

type InterviewRow = {
  id: string;
  candidate_id: string;
  interviewer_ids: string[];
  scheduled_at: string;
};
type CandidateSummary = {
  id: string;
  full_name: string;
  jobs: { title: string } | null;
};

async function loadCandidateSummaries(candidateIds: string[]) {
  if (!candidateIds.length) return new Map<string, CandidateSummary>();
  const { data } = await supabaseAdmin
    .from("candidates")
    .select("id, full_name, jobs(title)")
    .in("id", candidateIds);
  return new Map(
    ((data ?? []) as unknown as CandidateSummary[]).map((candidate) => [
      candidate.id,
      candidate,
    ]),
  );
}

async function sendInterviewReminders(
  now: Date,
  byId: Map<string, UserRow>,
  prefs: Map<string, PrefRow>,
  counts: DigestCounts,
) {
  const until = new Date(
    now.getTime() + REMINDER_LEAD_MINUTES * 60_000,
  ).toISOString();
  const { data } = await supabaseAdmin
    .from("candidate_interviews")
    .select("id,candidate_id,interviewer_ids,scheduled_at")
    .gt("scheduled_at", now.toISOString())
    .lte("scheduled_at", until);
  const interviews = (data ?? []) as unknown as InterviewRow[];
  const candidates = await loadCandidateSummaries([
    ...new Set(interviews.map((interview) => interview.candidate_id)),
  ]);
  for (const interview of interviews) {
    const candidate = candidates.get(interview.candidate_id);
    if (!candidate) continue;
    for (const interviewerId of interview.interviewer_ids ?? []) {
      const interviewer = byId.get(interviewerId);
      const pref = prefs.get(interviewerId);
      if (!interviewer || pref?.slack_enabled === false) continue;
      const timezone = pref?.slack_timezone ?? DEFAULT_TIMEZONE;
      const message = buildInterviewReminder({
        candidateName: candidate.full_name,
        roleTitle: candidate.jobs?.title ?? "this role",
        time: clockLabel(new Date(interview.scheduled_at), timezone),
        appUrl: appUrl(),
      });
      const outcome = await deliverSlackNotification({
        eventKey: `interview-reminder:${interview.id}:${interviewerId}`,
        recipientUserId: interviewerId,
        category: "interview_reminder",
        text: message.text,
        blocks: message.blocks,
        digest: true,
      });
      record(counts, outcome);
      if (outcome === "delivered") counts.interviewReminders += 1;
    }
  }
}

async function sendOverdueScorecardReminders(
  now: Date,
  byId: Map<string, UserRow>,
  prefs: Map<string, PrefRow>,
  counts: DigestCounts,
) {
  const from = new Date(now.getTime() - 14 * 24 * 60 * 60_000).toISOString();
  const { data } = await supabaseAdmin
    .from("candidate_interviews")
    .select("id,candidate_id,interviewer_ids,scheduled_at")
    .gte("scheduled_at", from)
    .lt("scheduled_at", now.toISOString());
  const interviews = (data ?? []) as unknown as InterviewRow[];
  const candidateIds = [
    ...new Set(interviews.map((item) => item.candidate_id)),
  ];
  const [{ data: scorecards }, candidates] = await Promise.all([
    candidateIds.length
      ? supabaseAdmin
          .from("interview_scorecards")
          .select("candidate_id,interviewer_id")
          .in("candidate_id", candidateIds)
          .not("submitted_at", "is", null)
      : Promise.resolve({ data: [] }),
    loadCandidateSummaries(candidateIds),
  ]);
  const completed = new Set(
    (
      (scorecards ?? []) as { candidate_id: string; interviewer_id: string }[]
    ).map(
      (scorecard) => `${scorecard.candidate_id}:${scorecard.interviewer_id}`,
    ),
  );
  for (const interview of interviews) {
    const candidate = candidates.get(interview.candidate_id);
    if (!candidate) continue;
    for (const interviewerId of interview.interviewer_ids ?? []) {
      if (completed.has(`${interview.candidate_id}:${interviewerId}`)) continue;
      if (
        !byId.has(interviewerId) ||
        prefs.get(interviewerId)?.slack_enabled === false
      )
        continue;
      const message = buildInterviewReminder({
        candidateName: candidate.full_name,
        roleTitle: candidate.jobs?.title ?? "this role",
        time: "",
        overdue: true,
        appUrl: appUrl(),
      });
      const outcome = await deliverSlackNotification({
        eventKey: `interview-scorecard-overdue:${interview.id}:${interviewerId}`,
        recipientUserId: interviewerId,
        category: "interview_scorecard_overdue",
        text: message.text,
        blocks: message.blocks,
        digest: true,
      });
      record(counts, outcome);
      if (outcome === "delivered") counts.overdueScorecards += 1;
    }
  }
}

async function sendHallOfFameClosingReminder(now: Date, counts: DigestCounts) {
  const today = localClock(now, DEFAULT_TIMEZONE).date;
  for (const daysRemaining of [3, 1]) {
    const closesOn = addDays(today, daysRemaining);
    const { data } = await db
      .from("hall_of_fame_cycles")
      .select("id,closes_at")
      .eq("status", "open")
      .eq("closes_at", closesOn);
    for (const cycle of (data ?? []) as { id: string; closes_at: string }[]) {
      const message = buildHallOfFameClosingReminder({
        daysRemaining,
        appUrl: appUrl(),
      });
      const outcome = await postSlackChannelNotification({
        // Keep the original 3-day event key stable, while allowing one final
        // reminder for the same cycle without duplicate hourly deliveries.
        eventKey:
          daysRemaining === 3
            ? `hall-of-fame-nominations-closing:${cycle.id}:${cycle.closes_at}`
            : `hall-of-fame-nominations-closing-final:${cycle.id}:${cycle.closes_at}`,
        category: "hall_of_fame_nominations",
        text: message.text,
        blocks: message.blocks,
      });
      record(counts, outcome);
      if (outcome === "delivered") counts.hallOfFameReminders += 1;
    }
  }
}

/**
 * Sends "Remind me later" snoozes that are due. Each one is re-checked first:
 * a review acknowledged or a check-in reviewed in the meantime is dropped
 * silently. Every due snooze is marked sent whatever the outcome, so a
 * suppressed or failed reminder is never retried in a loop.
 */
async function sendDueSnoozedReminders(
  now: Date,
  counts: DigestCounts,
) {
  const { data } = await db
    .from("slack_reminder_snoozes")
    .select("id, user_id, kind, target_id")
    .is("sent_at", null)
    .lte("remind_after", now.toISOString())
    .limit(200);
  const rows = (data ?? []) as {
    id: string;
    user_id: string;
    kind: "review_acknowledgement" | "checkin_review";
    target_id: string;
  }[];

  for (const row of rows) {
    let message: ReturnType<typeof buildReviewAcknowledgementReminder> = null;
    let category: "review_open" | "checkin_reminder" = "review_open";

    if (row.kind === "review_acknowledgement") {
      const { outstanding, singleReviewId } =
        await outstandingReviewAcknowledgements(row.user_id);
      message = buildReviewAcknowledgementReminder({
        outstanding,
        singleReviewId,
        appUrl: appUrl(),
      });
    } else {
      const [employeeId, weekStart] = row.target_id.split("|");
      if (employeeId && weekStart) {
        const { data: checkin } = await db
          .from("checkins")
          .select("status")
          .eq("user_id", employeeId)
          .eq("week_start", weekStart)
          .maybeSingle();
        if (checkin?.status === "submitted") {
          message = buildCheckinReviewReminder({
            appUrl: appUrl(),
            employeeId,
            weekStart,
          });
          category = "checkin_reminder";
        }
      }
    }

    if (message) {
      const outcome = await deliverSlackNotification({
        eventKey: `snooze:${row.id}`,
        recipientUserId: row.user_id,
        category,
        text: message.text,
        blocks: message.blocks,
        digest: true,
      });
      record(counts, outcome);
      if (outcome === "delivered") counts.snoozedReminders += 1;
    }

    await db
      .from("slack_reminder_snoozes")
      .update({ sent_at: now.toISOString() })
      .eq("id", row.id);
  }
}

function appUrl() {
  return process.env.PRODUCTION_APP_URL ?? "http://localhost:3000";
}

// ── Culture announcements (company channel) ─────────────────────────────────
// Only the approved events below reach the channel. Names appear only for
// people who opted in to culture announcements. Everything else is a count.

function optedIn(prefs: Map<string, PrefRow>, userId: string) {
  return prefs.get(userId)?.culture_announcements === true;
}

/** Wall of Fame winners and newly live Side Quests are posted as they happen. */
async function publishCultureAnnouncements(
  now: Date,
  byId: Map<string, UserRow>,
  prefs: Map<string, PrefRow>,
  counts: DigestCounts,
) {
  await publishRecentPublicRecognitions(now, byId, prefs, counts);
  const since = new Date(now.getTime() - 26 * 3_600_000).toISOString();

  const { data: winners } = await db
    .from("hall_of_fame_winners")
    .select("id, nominee_id, category, published_at")
    .gte("published_at", since);
  for (const winner of (winners ?? []) as {
    id: string;
    nominee_id: string;
    category: string;
    published_at: string;
  }[]) {
    const name = optedIn(prefs, winner.nominee_id)
      ? byId.get(winner.nominee_id)?.name
      : undefined;
    const text = name
      ? `${name} has been named a Wall of Fame winner. Congratulations!`
      : "A teammate has been named a Wall of Fame winner. Congratulations!";
    const outcome = await postSlackChannelNotification({
      eventKey: `culture:wall-of-fame:${winner.id}`,
      category: "culture_wall_of_fame",
      text,
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `<${appUrl()}/pulse/hall-of-fame|See the Wall of Fame>`,
            },
          ],
        },
      ],
    });
    record(counts, outcome);
    if (outcome === "delivered") counts.cultureAnnouncements += 1;
  }

  const { data: quests } = await supabaseAdmin
    .from("side_quests")
    .select("id, title, starts_at")
    .eq("status", "live")
    .gte("starts_at", since);
  for (const quest of (quests ?? []) as {
    id: string;
    title: string;
  }[]) {
    const text = `A new Side Quest is live: ${quest.title}`;
    const outcome = await postSlackChannelNotification({
      eventKey: `culture:side-quest:${quest.id}`,
      category: "culture_side_quest",
      text,
      blocks: [
        { type: "section", text: { type: "mrkdwn", text } },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `<${appUrl()}/pulse/side-quests|Take a look in Kazi>`,
            },
          ],
        },
      ],
    });
    record(counts, outcome);
    if (outcome === "delivered") counts.cultureAnnouncements += 1;
  }
}

/** Backfills recent public recognition once, then lets the ledger prevent repeats. */
async function publishRecentPublicRecognitions(
  now: Date,
  byId: Map<string, UserRow>,
  prefs: Map<string, PrefRow>,
  counts: DigestCounts,
) {
  const since = new Date(now.getTime() - 7 * 24 * 3_600_000).toISOString();
  const [{ data: recognitions }, { data: values }] = await Promise.all([
    supabaseAdmin
      .from("feedback")
      .select("id,from_user_id,to_user_id,message,value_id,media_url")
      .eq("visibility", "public")
      .gte("created_at", since),
    supabaseAdmin.from("recognition_values").select("id,name"),
  ]);
  const valueNames = new Map(
    ((values ?? []) as { id: string; name: string }[]).map((value) => [
      value.id,
      value.name,
    ]),
  );
  for (const recognition of (recognitions ?? []) as {
    id: string;
    from_user_id: string;
    to_user_id: string;
    message: string;
    value_id: string | null;
    media_url: string | null;
  }[]) {
    const recipientName = optedIn(prefs, recognition.to_user_id)
      ? (byId.get(recognition.to_user_id)?.name ?? null)
      : null;
    const senderName = optedIn(prefs, recognition.from_user_id)
      ? (byId.get(recognition.from_user_id)?.name ?? null)
      : null;
    const message = buildPublicRecognitionMessage({
      recipientName,
      senderName,
      valueName: recognition.value_id
        ? valueNames.get(recognition.value_id)
        : null,
      message: recognition.message,
      mediaUrl: recognition.media_url,
      appUrl: appUrl(),
    });
    const outcome = await postSlackChannelNotification({
      eventKey: `culture:recognition:${recognition.id}`,
      category: "culture_recognition",
      text: message.text,
      blocks: message.blocks,
    });
    record(counts, outcome);
    if (outcome === "delivered") counts.cultureAnnouncements += 1;
  }
}

/** Monday morning recap of the previous week. Posted once per week, skipped when empty. */
async function sendWeeklyCultureRecap(
  now: Date,
  byId: Map<string, UserRow>,
  prefs: Map<string, PrefRow>,
  counts: DigestCounts,
) {
  const clock = localClock(now, DEFAULT_TIMEZONE);
  if (
    clock.weekday !== 1 ||
    !inCatchUpWindow(
      clock,
      9 * 60,
      WINDOW_MINUTES,
      QUIET_HOURS_CATCH_UP_MINUTES,
    )
  )
    return;

  const thisWeek = weekStartOf(clock.date, clock.weekday);
  const lastWeek = addDays(thisWeek, -7);
  const from = `${lastWeek}T00:00:00.000Z`;
  const to = `${thisWeek}T00:00:00.000Z`;

  const [
    recognitions,
    milestones,
    goals,
    winners,
    quests,
    completions,
    checkins,
    dailyLogs,
  ] = await Promise.all([
    supabaseAdmin
      .from("feedback")
      .select("to_user_id, campaign_id")
      .eq("visibility", "public")
      .gte("created_at", from)
      .lt("created_at", to),
    db
      .from("milestones")
      .select("user_id")
      .gte("milestone_date", lastWeek)
      .lt("milestone_date", thisWeek),
    supabaseAdmin
      .from("goals")
      .select("owner_id")
      .eq("status", "completed")
      .gte("updated_at", from)
      .lt("updated_at", to),
    db
      .from("hall_of_fame_winners")
      .select("nominee_id")
      .gte("published_at", from)
      .lt("published_at", to),
    supabaseAdmin.from("side_quests").select("title").eq("status", "live"),
    db
      .from("side_quest_completions")
      .select("id")
      .eq("status", "approved")
      .gte("completed_at", from)
      .lt("completed_at", to),
    supabaseAdmin
      .from("checkins")
      .select("user_id")
      .eq("week_start", lastWeek)
      .in("status", ["submitted", "reviewed"]),
    db
      .from("daily_activity_logs")
      .select("entries")
      .gte("log_date", lastWeek)
      .lt("log_date", thisWeek),
  ]);

  const namesFor = (ids: (string | null)[]) => [
    ...new Set(
      ids
        .filter(
          (id): id is string => Boolean(id) && optedIn(prefs, id as string),
        )
        .map((id) => byId.get(id)?.name)
        .filter((name): name is string => Boolean(name)),
    ),
  ];
  // Recognition tied to a campaign for a narrower audience stays out of the channel.
  const restrictedCampaigns = new Set(
    (
      ((
        await db
          .from("recognition_campaigns")
          .select("id")
          .neq("audience_type", "company")
      ).data ?? []) as { id: string }[]
    ).map((campaign) => campaign.id),
  );
  const recognitionRows = (
    (recognitions.data ?? []) as {
      to_user_id: string;
      campaign_id: string | null;
    }[]
  ).filter(
    (row) => !row.campaign_id || !restrictedCampaigns.has(row.campaign_id),
  );
  const milestoneRows = (milestones.data ?? []) as { user_id: string }[];
  const goalRows = (goals.data ?? []) as { owner_id: string | null }[];
  const winnerRows = (winners.data ?? []) as { nominee_id: string }[];
  const submittedCheckins = new Set(
    ((checkins.data ?? []) as { user_id: string }[]).map(
      (checkin) => checkin.user_id,
    ),
  ).size;
  const focusedMinutes = ((dailyLogs.data ?? []) as { entries: unknown }[])
    .flatMap((row) => (Array.isArray(row.entries) ? row.entries : []))
    .reduce(
      (total, entry) =>
        total +
        (typeof entry === "object" &&
        entry !== null &&
        typeof (entry as { minutes?: unknown }).minutes === "number"
          ? Math.max(0, (entry as { minutes: number }).minutes)
          : 0),
      0,
    );

  const recap = buildCultureRecap({
    checkins: { submitted: submittedCheckins, eligibleStaff: byId.size },
    focusedMinutes,
    recognitions: {
      count: recognitionRows.length,
      optedInNames: namesFor(recognitionRows.map((row) => row.to_user_id)),
    },
    milestones: {
      count: milestoneRows.length,
      optedInNames: namesFor(milestoneRows.map((row) => row.user_id)),
    },
    goalsCompleted: {
      count: goalRows.length,
      optedInNames: namesFor(goalRows.map((row) => row.owner_id)),
    },
    sideQuests: {
      liveTitles: ((quests.data ?? []) as { title: string }[]).map(
        (quest) => quest.title,
      ),
      completedThisWeek: ((completions.data ?? []) as unknown[]).length,
    },
    wallOfFameWinners: {
      count: winnerRows.length,
      optedInNames: namesFor(winnerRows.map((row) => row.nominee_id)),
    },
  });
  if (!recap) return;

  const link = `${appUrl()}/pulse`;
  const text = `${recap.text}: ${recap.lines.length} update${recap.lines.length === 1 ? "" : "s"}`;
  const outcome = await postSlackChannelNotification({
    eventKey: `culture-recap:${lastWeek}`,
    category: "culture_recap",
    text,
    blocks: [
      { type: "header", text: { type: "plain_text", text: recap.text } },
      {
        type: "section",
        text: { type: "mrkdwn", text: recap.lines.join("\n") },
      },
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: `<${link}|Open Kazi>` }],
      },
    ],
  });
  record(counts, outcome);
  if (outcome === "delivered") counts.cultureRecaps += 1;
}
