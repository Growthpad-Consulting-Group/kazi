import { supabaseAdmin } from "@/lib/supabase";
import { can } from "@/lib/rbac";
import { buildManagerAttention, type AttentionItem } from "./manager-queue";

export type ReportCheckin = {
  user_id: string;
  name: string;
  status: "draft" | "submitted" | "reviewed";
  mood: number | null;
  blockers: string | null;
};

const LOW_MOOD = 2;

type Flag = { name: string; reason: "blocker" | "low_mood" };
type Role = Parameters<typeof can>[0];

/**
 * Builds the viewer's "Needs attention" queue. Every source is scoped by role:
 * managers see only direct reports, HR sees Voice Out cases assigned to them,
 * and admins see organisation-level approvals. Sources the viewer cannot use
 * are skipped entirely rather than shown as empty.
 */
export async function loadManagerAttention({
  userId,
  role,
  reportIds,
  teamCheckins,
}: {
  userId: string;
  role: Role;
  /** Every active direct report, whether or not they have checked in this week. */
  reportIds: string[];
  teamCheckins: ReportCheckin[];
}): Promise<AttentionItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed tables lag generated types
  const db = supabaseAdmin as any;

  const canOvertime = can(role, "manage_checkins");
  const canVoiceOut = can(role, "manage_voice_out");
  const canRewards = can(role, "manage_rewards");
  const canQuests = can(role, "manage_side_quests");
  const canInterview = can(role, "conduct_interviews");

  const overtimeScopeIds: string[] | null =
    role === "manager" ? reportIds : canOvertime ? null : [];

  const [overtime, voiceOut, reviews, redemptions, approvals, interviews] =
    await Promise.all([
      overtimeScopeIds && !overtimeScopeIds.length
        ? Promise.resolve({ count: 0 })
        : (() => {
            let query = db
              .from("overtime_requests")
              .select("id", { count: "exact", head: true })
              .eq("status", "pending");
            if (overtimeScopeIds) query = query.in("user_id", overtimeScopeIds);
            return query;
          })(),
      canVoiceOut
        ? db
            .from("voice_out_reports")
            .select("id", { count: "exact", head: true })
            .eq("owner_id", userId)
            .in("status", ["new", "in_review"])
        : Promise.resolve({ count: null }),
      db
        .from("performance_reviews")
        .select("id, review_cycles!inner(status)", {
          count: "exact",
          head: true,
        })
        .eq("reviewer_id", userId)
        .is("submitted_at", null)
        .neq("review_cycles.status", "completed"),
      canRewards
        ? db
            .from("reward_redemptions")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending")
        : Promise.resolve({ count: null }),
      canQuests
        ? db
            .from("side_quest_completions")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending")
        : Promise.resolve({ count: null }),
      canInterview
        ? db
            .from("candidate_interviews")
            .select("candidate_id")
            .contains("interviewer_ids", [userId])
            .lt("scheduled_at", new Date().toISOString())
            .limit(100)
        : Promise.resolve({ data: null }),
    ]);

  const interviewCandidateIds = [
    ...new Set(
      ((interviews.data ?? []) as { candidate_id: string }[]).map(
        (interview) => interview.candidate_id,
      ),
    ),
  ];
  const submittedScorecards = interviewCandidateIds.length
    ? await db
        .from("interview_scorecards")
        .select("candidate_id")
        .eq("interviewer_id", userId)
        .not("submitted_at", "is", null)
        .in("candidate_id", interviewCandidateIds)
    : { data: [] as { candidate_id: string }[] };
  const submittedCandidateIds = new Set(
    ((submittedScorecards.data ?? []) as { candidate_id: string }[]).map(
      (scorecard) => scorecard.candidate_id,
    ),
  );

  const flaggedReports = teamCheckins.flatMap((checkin): Flag[] => {
    if (checkin.blockers?.trim())
      return [{ name: checkin.name, reason: "blocker" as const }];
    if (checkin.mood !== null && checkin.mood <= LOW_MOOD)
      return [{ name: checkin.name, reason: "low_mood" as const }];
    return [];
  });

  return buildManagerAttention({
    flaggedReports,
    openVoiceOutCases: voiceOut.count ?? null,
    pendingOvertime: overtime.count ?? 0,
    checkinsAwaitingReview: teamCheckins.filter(
      (checkin) => checkin.status === "submitted",
    ).length,
    overdueScorecards: canInterview
      ? interviewCandidateIds.filter((id) => !submittedCandidateIds.has(id))
          .length
      : null,
    reviewsToComplete: reviews.count ?? 0,
    pendingRedemptions: redemptions.count ?? null,
    pendingQuestApprovals: approvals.count ?? null,
  });
}
