import { supabaseAdmin } from "@/lib/supabase";
import { effectiveSideQuestStatus } from "@/lib/side-quest-lifecycle";
import { audienceUserIds } from "@/features/pulse/surveys/audience";
import type { WallOfFameSignal, OpenSurveySignal } from "./next-steps";
import { localClock } from "@/lib/slack-schedule";
import { resolveWallOfFameStage } from "@/lib/wall-of-fame-stage";

// Mirrors the roles allowed to vote in the management stage of Wall of Fame
// (see api/pulse/wall-of-fame/votes). Managers participate with the team.
const MANAGEMENT_ROLES = new Set(["admin", "hr"]);

// Several tables are migration-backed and lag the generated database types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see note above
const db = supabaseAdmin as any;

function endOfDay(date: string | null): Date | null {
  return date ? new Date(`${date}T23:59:59`) : null;
}

export type EmployeeQueueSignals = {
  unacknowledgedReviews: number;
  openSurveys: OpenSurveySignal[];
  outstandingSideQuests: number;
  wallOfFame: WallOfFameSignal | null;
};

/**
 * Gathers the employee-only signals for the "Your next step" queue.
 * Each query is scoped to the signed-in user, so no other staff member's
 * responses, nominations or reviews leave the database.
 */
export async function loadEmployeeQueueSignals(
  userId: string,
  role: string,
  now: Date,
): Promise<EmployeeQueueSignals> {
  const [reviews, surveys, sideQuests, wallOfFame] = await Promise.all([
    loadUnacknowledgedReviews(userId),
    loadOpenSurveys(userId, now),
    loadOutstandingSideQuests(userId, now),
    loadWallOfFameStep(userId, role, now),
  ]);

  return {
    unacknowledgedReviews: reviews,
    openSurveys: surveys,
    outstandingSideQuests: sideQuests,
    wallOfFame,
  };
}

async function loadUnacknowledgedReviews(userId: string): Promise<number> {
  const { data } = await db
    .from("performance_reviews")
    .select("id, reviewer_id, review_cycles(results_released_at)")
    .eq("reviewee_id", userId)
    .is("employee_acknowledged_at", null);

  return (
    (data ?? []) as {
      reviewer_id: string;
      review_cycles: { results_released_at: string | null } | null;
    }[]
  ).filter(
    (review) =>
      review.reviewer_id !== userId &&
      review.review_cycles?.results_released_at != null,
  ).length;
}

async function loadOpenSurveys(
  userId: string,
  now: Date,
): Promise<OpenSurveySignal[]> {
  const { data: active } = await db
    .from("surveys")
    .select("id, title, closes_at")
    .eq("status", "active")
    .limit(20);
  const candidates = (active ?? []) as {
    id: string;
    title: string;
    closes_at: string | null;
  }[];
  const open = candidates.filter(
    (survey) => !survey.closes_at || new Date(survey.closes_at) >= now,
  );
  if (!open.length) return [];

  const { data: answered } = await db
    .from("survey_participants")
    .select("survey_id")
    .eq("user_id", userId)
    .in(
      "survey_id",
      open.map((survey) => survey.id),
    );
  const answeredIds = new Set(
    ((answered ?? []) as { survey_id: string }[]).map((row) => row.survey_id),
  );

  const unanswered = open.filter((survey) => !answeredIds.has(survey.id));
  const audiences = await Promise.all(
    unanswered.map((survey) => audienceUserIds(survey.id)),
  );

  return unanswered.flatMap((survey, index) =>
    audiences[index].includes(userId)
      ? [
          {
            title: survey.title,
            closesAt: survey.closes_at ? new Date(survey.closes_at) : null,
          },
        ]
      : [],
  );
}

async function loadOutstandingSideQuests(
  userId: string,
  now: Date,
): Promise<number> {
  const { data: quests } = await db
    .from("side_quests")
    .select("id, status, starts_at, ends_at, completion_mode")
    .eq("completion_mode", "evidence_required")
    .in("status", ["upcoming", "live"]);
  const live = (
    (quests ?? []) as {
      id: string;
      status: "draft" | "upcoming" | "live" | "closed" | "archived";
      starts_at: string | null;
      ends_at: string | null;
    }[]
  ).filter((quest) => effectiveSideQuestStatus(quest, now) === "live");
  if (!live.length) return 0;

  const { data: completions } = await db
    .from("side_quest_completions")
    .select("side_quest_id, status")
    .eq("user_id", userId)
    .in(
      "side_quest_id",
      live.map((quest) => quest.id),
    );
  // A non-rejected completion means the employee has already acted on it.
  const acted = new Set(
    ((completions ?? []) as { side_quest_id: string; status: string }[])
      .filter((row) => row.status !== "rejected")
      .map((row) => row.side_quest_id),
  );
  return live.filter((quest) => !acted.has(quest.id)).length;
}

async function loadWallOfFameStep(
  userId: string,
  role: string,
  now: Date,
): Promise<WallOfFameSignal | null> {
  const { data } = await db
    .from("wall_of_fame_cycles")
    .select(
      "id, title, status, closes_at, team_voting_opens_at, team_voting_closes_at, management_voting_opens_at, management_voting_closes_at",
    )
    .neq("status", "published")
    .order("month", { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = data as {
    id: string;
    title: string;
    status: string;
    closes_at: string | null;
    team_voting_opens_at: string | null;
    team_voting_closes_at: string | null;
    management_voting_opens_at: string | null;
    management_voting_closes_at: string | null;
  } | null;
  if (!row) return null;
  // Use the stage the dates imply, so a stale stored status can't create a task.
  const currentStage = resolveWallOfFameStage(
    row,
    localClock(now, "Africa/Nairobi").date,
  );
  if (
    currentStage !== "open" &&
    currentStage !== "team_voting" &&
    currentStage !== "management_voting"
  )
    return null;
  const cycle = { ...row, status: currentStage };

  if (cycle.status === "open") {
    const { data: own } = await db
      .from("wall_of_fame_nominations")
      .select("id")
      .eq("cycle_id", cycle.id)
      .eq("nominator_id", userId)
      .limit(1);
    if (own?.length) return null;
    return {
      action: "nominate",
      cycleTitle: cycle.title,
      closesAt: endOfDay(cycle.closes_at),
    };
  }

  const voterStage =
    cycle.status === "management_voting" ? "management" : "team";
  const eligible =
    voterStage === "management"
      ? MANAGEMENT_ROLES.has(role)
      : !MANAGEMENT_ROLES.has(role);
  if (!eligible) return null;

  const { data: votes } = await db
    .from("wall_of_fame_votes")
    .select("id")
    .eq("cycle_id", cycle.id)
    .eq("voter_id", userId)
    .eq("stage", voterStage)
    .limit(1);
  if (votes?.length) return null;

  const closesAt = endOfDay(
    voterStage === "management"
      ? cycle.management_voting_closes_at
      : cycle.team_voting_closes_at,
  );
  if (closesAt && closesAt < now) return null;
  return { action: "vote", cycleTitle: cycle.title, closesAt };
}
