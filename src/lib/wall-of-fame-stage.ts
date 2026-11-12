// Wall of Fame stage rules. The stored status is an admin override; the dates decide
// when a stage starts, so a cycle can't show "open" after nominations have closed.
// Stages only move forward. "published" is final and is only set by an admin.

export const WALL_OF_FAME_STAGES = [
  "open",
  "closed",
  "team_voting",
  "management_voting",
  "published",
] as const;

export type WallOfFameStage = (typeof WALL_OF_FAME_STAGES)[number];

const RANK: Record<WallOfFameStage, number> = {
  open: 0,
  closed: 1,
  team_voting: 2,
  management_voting: 3,
  published: 4,
};

export type WallOfFameStageInput = {
  status: string | null;
  closes_at: string | null;
  team_voting_opens_at: string | null;
  management_voting_opens_at: string | null;
};

function isStage(value: string | null): value is WallOfFameStage {
  return (
    value !== null && (WALL_OF_FAME_STAGES as readonly string[]).includes(value)
  );
}

/**
 * Returns the stage a cycle is in on `today` (YYYY-MM-DD, in the work timezone).
 * It is the later of the stored status and the stage the dates imply.
 */
export function resolveWallOfFameStage(
  cycle: WallOfFameStageInput,
  today: string,
): WallOfFameStage {
  const stored: WallOfFameStage = isStage(cycle.status) ? cycle.status : "open";
  if (stored === "published") return "published";

  let fromDates: WallOfFameStage = "open";
  if (cycle.closes_at && today > cycle.closes_at) fromDates = "closed";
  if (cycle.team_voting_opens_at && today >= cycle.team_voting_opens_at)
    fromDates = "team_voting";
  if (
    cycle.management_voting_opens_at &&
    today >= cycle.management_voting_opens_at
  )
    fromDates = "management_voting";

  return RANK[fromDates] > RANK[stored] ? fromDates : stored;
}
