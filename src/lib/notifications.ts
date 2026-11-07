import { supabaseAdmin } from "@/lib/supabase";
import { invalidateUserNotifications } from "@/lib/cache/invalidate";
import type { UserRole } from "@/types/database";

/**
 * Centralised notification helpers.
 * All functions insert a row into the `notifications` table via supabaseAdmin.
 * Import these from API routes and server actions only (server-side).
 */

/** Roles that receive hiring/recruiter notifications. */
export const RECRUITER_ROLES: UserRole[] = ["admin", "hr", "hiring_manager"];

async function createNotifications(
  rows: { user_id: string; message: string; link?: string | null }[],
): Promise<void> {
  if (!rows.length) return;
  const { error } = await supabaseAdmin.from("notifications").insert(rows);
  if (error) {
    // A notification must never roll back the action that produced it.
    console.error("Could not create in-app notification", error.message);
    return;
  }
  await Promise.all(
    [...new Set(rows.map((row) => row.user_id))].map(
      invalidateUserNotifications,
    ),
  );
}

/**
 * Send an in-app notification to all active users whose role is in `roles`.
 */
export async function notifyRoles(
  roles: UserRole[],
  message: string,
  link?: string,
): Promise<void> {
  const { data: users } = await supabaseAdmin
    .from("users")
    .select("id")
    .in("role", roles)
    .eq("is_active", true);
  if (!users?.length) return;
  await createNotifications(
    users.map((user) => ({
      user_id: user.id,
      message,
      link: link ?? null,
    })),
  );
}

export async function notifyRecognitionReceived(
  userId: string,
  fromName: string,
  message: string,
): Promise<void> {
  const preview = message.length > 80 ? `${message.slice(0, 80)}…` : message;
  await createNotifications([
    {
      user_id: userId,
      message: `${fromName} recognised you: "${preview}"`,
      link: "/pulse/feedback",
    },
  ]);
}

export async function notifyOneOnOneScheduled(
  meetingId: string,
  managerId: string,
  reportId: string,
  scheduledAt: string,
): Promise<void> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id, name")
    .in("id", [managerId, reportId]);
  const people = (data ?? []) as { id: string; name: string }[];
  const manager = people.find((u) => u.id === managerId);
  const report = people.find((u) => u.id === reportId);
  if (!manager || !report) return;

  const when = new Date(scheduledAt).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
  const link = `/pulse/one-on-ones/${meetingId}`;
  await createNotifications([
    {
      user_id: managerId,
      message: `1-on-1 with ${report.name} scheduled for ${when}`,
      link,
    },
    {
      user_id: reportId,
      message: `1-on-1 with ${manager.name} scheduled for ${when}`,
      link,
    },
  ]);
}

export async function notifyManagerOfCheckin(
  managerId: string,
  employeeName: string,
  employeeId: string,
  hasBlockers: boolean,
): Promise<void> {
  await createNotifications([
    {
      user_id: managerId,
      message: `${employeeName} submitted their weekly check-in${hasBlockers ? " with a blocker" : ""}.`,
      link: `/pulse/checkins?user=${employeeId}`,
    },
  ]);
}

export async function notifyCheckinSubmissionReceived(
  userId: string,
  weekStart: string,
): Promise<void> {
  const weekLabel = new Date(`${weekStart}T12:00:00Z`).toLocaleDateString(
    "en-KE",
    { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" },
  );
  await createNotifications([
    {
      user_id: userId,
      message: `Weekly check-in submitted for the week of ${weekLabel}.`,
      link: "/pulse/checkins?tab=checkins",
    },
  ]);
}

export async function notifyMilestone(
  userId: string,
  type: string,
  years?: number,
): Promise<void> {
  let label: string;
  if (type === "work_anniversary") {
    label = `Work anniversary${years ? ` — ${years} year${years === 1 ? "" : "s"}` : ""}`;
  } else if (type === "birthday") {
    label = "Happy birthday!";
  } else if (type === "onboarding_complete") {
    label = "Welcome — onboarding complete!";
  } else {
    label = "Service achievement";
  }
  await createNotifications([
    { user_id: userId, message: `Milestone: ${label}`, link: "/pulse" },
  ]);
}

export async function notifyCampaignLive(
  userId: string,
  campaignName: string,
): Promise<void> {
  await createNotifications([
    {
      user_id: userId,
      message: `Campaign now live: ${campaignName}`,
      link: "/pulse/campaigns",
    },
  ]);
}

export async function notifyQuestEndingSoon(
  userId: string,
  questTitle: string,
  endsAt: string,
): Promise<void> {
  const dt = new Date(endsAt).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
  });
  await createNotifications([
    {
      user_id: userId,
      message: `Side Quest ending soon (${dt}): ${questTitle}`,
      link: "/pulse/side-quests",
    },
  ]);
}

export async function notifyQuestLive(userId: string, questTitle: string) {
  await createNotifications([
    {
      user_id: userId,
      message: `New Side Quest: ${questTitle}`,
      link: "/pulse/side-quests",
    },
  ]);
}

export async function notifySurveyClosingSoon(
  userId: string,
  surveyTitle: string,
  closesAt: string,
): Promise<void> {
  const dt = new Date(closesAt).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
  });
  await createNotifications([
    {
      user_id: userId,
      message: `Survey closing soon (${dt}): ${surveyTitle}`,
      link: "/pulse/surveys",
    },
  ]);
}

export async function notifySurveyPublished(
  userId: string,
  surveyTitle: string,
  surveyId: string,
): Promise<void> {
  await createNotifications([
    {
      user_id: userId,
      message: `New survey: ${surveyTitle}`,
      link: `/pulse/surveys/${surveyId}`,
    },
  ]);
}

export async function notifyWeeklyDigest(
  userId: string,
  summary: { questsCompleted: number; recognitionReceived: number },
): Promise<void> {
  const parts: string[] = [];
  if (summary.recognitionReceived > 0) {
    parts.push(
      `${summary.recognitionReceived} recognition${summary.recognitionReceived === 1 ? "" : "s"} received`,
    );
  }
  if (summary.questsCompleted > 0) {
    parts.push(
      `${summary.questsCompleted} Side Quest${summary.questsCompleted === 1 ? "" : "s"} completed`,
    );
  }
  if (!parts.length) return;
  await createNotifications([
    {
      user_id: userId,
      message: `Your week: ${parts.join(", ")}.`,
      link: "/pulse",
    },
  ]);
}
