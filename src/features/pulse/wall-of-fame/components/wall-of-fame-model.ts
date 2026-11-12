// Shared types, award categories and date helpers for the Wall of Fame screens.

export type Cycle = {
  id: string;
  month: string;
  status:
    | "draft"
    | "open"
    | "team_voting"
    | "management_voting"
    | "published"
    | "closed";
  opens_at: string | null;
  closes_at: string | null;
  team_voting_opens_at: string | null;
  team_voting_closes_at: string | null;
  management_voting_opens_at: string | null;
  management_voting_closes_at: string | null;
} | null;
export type Staff = {
  id: string;
  name: string;
  job_title: string | null;
  department: string | null;
  avatar_url: string | null;
};
export type Nomination = {
  id: string;
  // These are deliberately redacted before the page reaches other staff.
  // Reviewers and the person who submitted the nomination receive the source text.
  nominator_id: string | null;
  nominee_id: string;
  impact_statement: string | null;
  public_highlight: string | null;
  category: string;
  created_at: string;
};
export type Vote = {
  nominee_id: string;
  voter_id: string;
  category: string;
  score: number;
  stage: "team" | "management";
};
export type Winner = {
  id: string;
  nominee_id: string;
  category: string;
  team_score: number | null;
  management_score: number | null;
  prize_status: "pending" | "ordered" | "delivered";
};

export function monthLabel(month: string) {
  return new Date(`${month}T12:00:00`).toLocaleDateString("en-KE", {
    month: "long",
    year: "numeric",
  });
}

export function nominationWindowLabel(cycle: NonNullable<Cycle>) {
  const format = (value: string) =>
    new Date(`${value}T12:00:00`).toLocaleDateString("en-KE", {
      day: "numeric",
      month: "short",
    });
  if (cycle.opens_at && cycle.closes_at)
    return `Nominations: ${format(cycle.opens_at)} – ${format(cycle.closes_at)}`;
  if (cycle.closes_at) return `Closes ${format(cycle.closes_at)}`;
  if (cycle.opens_at) return `Open from ${format(cycle.opens_at)}`;
  return null;
}

export function nominationCountdown(cycle: NonNullable<Cycle>) {
  if (!cycle.closes_at) return null;
  const closeAt = new Date(`${cycle.closes_at}T23:59:59`).getTime();
  const days = Math.max(0, Math.ceil((closeAt - Date.now()) / 86_400_000));
  if (days === 0) return { label: "Closes today", urgent: true };
  return {
    label: `${days} day${days === 1 ? "" : "s"} remaining`,
    urgent: days <= 3,
  };
}

export function toDateString(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function recommendedCycleSchedule(month: string) {
  const prefix = month.slice(0, 7);
  return {
    opensAt: `${prefix}-01`,
    closesAt: `${prefix}-07`,
    teamVotingOpensAt: `${prefix}-08`,
    teamVotingClosesAt: `${prefix}-12`,
    managementVotingOpensAt: `${prefix}-13`,
    managementVotingClosesAt: `${prefix}-15`,
  };
}
