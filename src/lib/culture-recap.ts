// Weekly company culture recap. Names appear only for people who opted in to
// culture announcements. Everything else is counted. Nothing here reads PIPs,
// reviews, candidates, check-in submissions or private feedback.

export type CultureRecapInput = {
  /** Aggregate minutes from daily logs. No individual work data is included. */
  focusedMinutes: number;
  /** Public recognition received this week, with names of opted-in recipients. */
  recognitions: { count: number; optedInNames: string[] };
  /** Work milestones celebrated this week. */
  milestones: { count: number; optedInNames: string[] };
  /** Goals completed this week. */
  goalsCompleted: { count: number; optedInNames: string[] };
  /** Side Quests live now, and approved completions this week. */
  sideQuests: { liveTitles: string[]; completedThisWeek: number };
  /** Wall of Fame winners published this week, names only when opted in. */
  wallOfFameWinners: { optedInNames: string[]; count: number };
};

export type CultureRecap = {
  text: string;
  lines: string[];
  /** A short closing line, shown after the highlights. */
  closing: string;
};

function pluralise(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** " — Ama, Kevin and 25 others". Shows up to three names, then counts the rest. */
function namesSuffix(names: string[]) {
  if (!names.length) return "";
  if (names.length <= 3) return ` — ${names.join(", ")}`;
  const others = names.length - 3;
  return ` — ${names.slice(0, 3).join(", ")} and ${others} ${others === 1 ? "other" : "others"}`;
}

function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder}m`;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

/** Returns null when there is nothing to celebrate, so an empty recap is never posted. */
export function buildCultureRecap(
  input: CultureRecapInput,
): CultureRecap | null {
  const lines: string[] = [];

  if (input.milestones.count > 0)
    lines.push(
      `• ${pluralise(input.milestones.count, "milestone")} celebrated${namesSuffix(input.milestones.optedInNames)}`,
    );
  if (input.recognitions.count > 0)
    lines.push(
      `• ${pluralise(input.recognitions.count, "recognition")} shared${namesSuffix(input.recognitions.optedInNames)}`,
    );
  if (input.goalsCompleted.count > 0)
    lines.push(
      `• ${pluralise(input.goalsCompleted.count, "goal")} completed${namesSuffix(input.goalsCompleted.optedInNames)}`,
    );
  if (input.wallOfFameWinners.count > 0)
    lines.push(
      `• ${pluralise(input.wallOfFameWinners.count, "Wall of Fame winner")} announced${namesSuffix(input.wallOfFameWinners.optedInNames)}`,
    );
  if (input.focusedMinutes > 0)
    lines.push(
      `• The team logged ${durationLabel(input.focusedMinutes)} of focused work`,
    );
  if (input.sideQuests.completedThisWeek > 0)
    lines.push(
      `• ${pluralise(input.sideQuests.completedThisWeek, "Side Quest")} completed this week`,
    );
  if (input.sideQuests.liveTitles.length > 0) {
    const titles = input.sideQuests.liveTitles;
    const shown = titles.slice(0, 3).map((title) => `  – ${title}`);
    const more = titles.length > 3 ? [`  – and ${titles.length - 3} more`] : [];
    lines.push(["• Live side quests:", ...shown, ...more].join("\n"));
  }

  if (!lines.length) return null;
  return {
    text: "This week at Growthpad",
    lines,
    closing: "Thank you, everyone. Keep it going next week.",
  };
}
