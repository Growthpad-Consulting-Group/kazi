import { supabaseAdmin } from "@/lib/supabase";
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
  buildDailyBrief,
  buildInterviewReminder,
  buildHallOfFameClosingReminder,
  buildManagerMondayPulse,
  buildManagerReviewQueue,
  buildOneOnOneFollowUp,
  buildOneOnOneReminder,
} from "@/lib/slack-digests";

const DEFAULT_TIMEZONE = "Africa/Nairobi";
const WINDOW_MINUTES = 60;
const QUIET_HOURS_CATCH_UP_MINUTES = 4 * 60;
const CHECKIN_NUDGE_START = 12 * 60; // Friday, 12:00 local
const MANAGER_REVIEW_START = 16 * 60; // Friday, 16:00 local
const REMINDER_LEAD_MINUTES = 90;
const FOLLOW_UP_MIN_AGE_MINUTES = 60;
const FOLLOW_UP_MAX_AGE_MINUTES = 180;
const WORKING_DAYS_DEFAULT = [1, 2, 3, 4, 5];

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
  hallOfFameReminders: number;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  manager_id: string | null;
};
type PrefRow = {
  user_id: string;
  slack_enabled: boolean;
  slack_quiet_start: string | null;
  slack_quiet_end: string | null;
  slack_timezone: string | null;
  slack_daily_brief: boolean;
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
    hallOfFameReminders: 0,
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
      .select("id, name, email, manager_id")
      .eq("is_active", true),
    db
      .from("user_notification_preferences")
      .select(
        "user_id, slack_enabled, slack_quiet_start, slack_quiet_end, slack_timezone, slack_daily_brief",
      ),
    db
      .from("staff_work_schedules")
      .select("user_id, timezone, workday_start, working_days"),
  ]);
  if (usersRes.error) throw new Error("Active staff could not be loaded");
  if (prefsRes.error) throw new Error("Slack preferences could not be loaded");

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
      await sendDailyBrief(user, byId, clock, timezone, now, weekStart, counts);
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
        await sendManagerPulse(user, reports, weekStart, counts);
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
  return counts;
}

async function sendDailyBrief(
  user: UserRow,
  byId: Map<string, UserRow>,
  clock: LocalClock,
  timezone: string,
  now: Date,
  weekStart: string,
  counts: DigestCounts,
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

  const entries = (log.data?.entries ?? []) as unknown[];
  const message = buildDailyBrief({
    firstName: user.name.split(" ")[0] || "there",
    meetings: meetingLines,
    goalsDueSoon: goals.data?.length ?? 0,
    logMissing: entries.length === 0,
    checkinPending: !["submitted", "reviewed"].includes(
      checkin.data?.status ?? "",
    ),
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

async function sendManagerPulse(
  manager: UserRow,
  reports: string[],
  weekStart: string,
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
  const message = buildManagerMondayPulse({
    missingCheckins: reports.filter((id) => !submitted.has(id)).length,
    flagged,
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
    .select("id, manager_id, report_id, scheduled_at")
    .gt("scheduled_at", now.toISOString())
    .lte("scheduled_at", until);

  for (const meeting of (data ?? []) as {
    id: string;
    manager_id: string;
    report_id: string;
    scheduled_at: string;
  }[]) {
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
  const closesOn = addDays(today, 3);
  const { data } = await db
    .from("hall_of_fame_cycles")
    .select("id,closes_at")
    .eq("status", "open")
    .eq("closes_at", closesOn);
  for (const cycle of (data ?? []) as { id: string; closes_at: string }[]) {
    const message = buildHallOfFameClosingReminder({
      daysRemaining: 3,
      appUrl: appUrl(),
    });
    const outcome = await postSlackChannelNotification({
      eventKey: `hall-of-fame-nominations-closing:${cycle.id}:${cycle.closes_at}`,
      category: "hall_of_fame_nominations",
      text: message.text,
      blocks: message.blocks,
    });
    record(counts, outcome);
    if (outcome === "delivered") counts.hallOfFameReminders += 1;
  }
}

function appUrl() {
  return process.env.PRODUCTION_APP_URL ?? "http://localhost:3000";
}
