import { describe, expect, it } from "vitest";
import { buildCultureRecap, type CultureRecapInput } from "./culture-recap";

const empty: CultureRecapInput = {
  checkins: { submitted: 0, eligibleStaff: 0 },
  focusedMinutes: 0,
  recognitions: { count: 0, optedInNames: [] },
  milestones: { count: 0, optedInNames: [] },
  goalsCompleted: { count: 0, optedInNames: [] },
  sideQuests: { liveTitles: [], completedThisWeek: 0 },
  wallOfFameWinners: { optedInNames: [], count: 0 },
};

describe("buildCultureRecap", () => {
  it("is skipped when there is no eligible content", () => {
    expect(buildCultureRecap(empty)).toBeNull();
  });

  it("names only the people who opted in and counts the rest", () => {
    const recap = buildCultureRecap({
      ...empty,
      recognitions: { count: 4, optedInNames: ["Amina"] },
      goalsCompleted: { count: 2, optedInNames: [] },
    });
    expect(recap).not.toBeNull();
    expect(recap!.lines).toEqual([
      "*Recognition:* 4 recognitions shared (Amina)",
      "*Goals completed:* 2 goals",
    ]);
  });

  it("includes only aggregate weekly work signals", () => {
    const recap = buildCultureRecap({
      ...empty,
      checkins: { submitted: 9, eligibleStaff: 11 },
      focusedMinutes: 7_575,
    });
    expect(recap!.lines).toEqual([
      "*Weekly updates:* 9/11 shared",
      "*Focused work:* 126h 15m logged",
    ]);
  });

  it("caps long name lists and uses singular wording", () => {
    const recap = buildCultureRecap({
      ...empty,
      milestones: { count: 1, optedInNames: ["A", "B", "C", "D", "E"] },
    });
    expect(recap!.lines[0]).toBe(
      "*Milestones:* 1 milestone celebrated (A, B, C and 2 more)",
    );
  });

  it("lists live Side Quests without exposing completions by person", () => {
    const recap = buildCultureRecap({
      ...empty,
      sideQuests: {
        liveTitles: ["Lunch and learn", "Tidy the kitchen"],
        completedThisWeek: 3,
      },
    });
    expect(recap!.lines).toEqual([
      "*Side Quests:* 3 completions approved this week",
      "*Live now:* Lunch and learn, Tidy the kitchen",
    ]);
  });
});
