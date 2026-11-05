// Weekly company culture recap. Names appear only for people who opted in to
// culture announcements. Everything else is counted. Nothing here reads PIPs,
// reviews, candidates or private feedback.

export type CultureRecapInput = {
  /** Submitted weekly check-ins, shared only as an aggregate coverage figure. */
  checkins: { submitted: number; eligibleStaff: number };
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
};

function pluralise(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function namesLine(names: string[]) {
  if (!names.length) return "";
  if (names.length <= 3) return ` (${names.join(", ")})`;
  return ` (${names.slice(0, 3).join(", ")} and ${names.length - 3} more)`;
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

  if (input.checkins.eligibleStaff > 0)
    lines.push(
      `*Weekly updates:* ${input.checkins.submitted}/${input.checkins.eligibleStaff} shared`,
    );
  if (input.focusedMinutes > 0)
    lines.push(`*Focused work:* ${durationLabel(input.focusedMinutes)} logged`);

  if (input.recognitions.count > 0)
    lines.push(
      `*Recognition:* ${pluralise(input.recognitions.count, "recognition")} shared${namesLine(input.recognitions.optedInNames)}`,
    );
  if (input.milestones.count > 0)
    lines.push(
      `*Milestones:* ${pluralise(input.milestones.count, "milestone")} celebrated${namesLine(input.milestones.optedInNames)}`,
    );
  if (input.goalsCompleted.count > 0)
    lines.push(
      `*Goals completed:* ${pluralise(input.goalsCompleted.count, "goal")}${namesLine(input.goalsCompleted.optedInNames)}`,
    );
  if (input.wallOfFameWinners.count > 0)
    lines.push(
      `*Wall of Fame:* ${pluralise(input.wallOfFameWinners.count, "winner")} announced${namesLine(input.wallOfFameWinners.optedInNames)}`,
    );
  if (input.sideQuests.completedThisWeek > 0)
    lines.push(
      `*Side Quests:* ${pluralise(input.sideQuests.completedThisWeek, "completion")} approved this week`,
    );
  if (input.sideQuests.liveTitles.length > 0)
    lines.push(
      `*Live now:* ${input.sideQuests.liveTitles.slice(0, 3).join(", ")}${input.sideQuests.liveTitles.length > 3 ? ` and ${input.sideQuests.liveTitles.length - 3} more` : ""}`,
    );

  if (!lines.length) return null;
  return {
    text: "This week at Growthpad",
    lines,
  };
}
