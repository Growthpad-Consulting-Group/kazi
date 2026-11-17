import { describe, expect, it } from "vitest";
import { buildCultureRecap, type CultureRecapInput } from "./culture-recap";

const empty: CultureRecapInput = {
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
      "4 recognitions shared — Amina",
      "2 goals completed",
    ]);
  });

  it("states focused work as a team total and never shows check-in counts", () => {
    const recap = buildCultureRecap({
      ...empty,
      focusedMinutes: 7_575,
    });
    expect(recap!.lines).toEqual([
      "The team logged 126h 15m of focused work",
    ]);
  });

  it("caps long name lists with a clear count of the others", () => {
    const recap = buildCultureRecap({
      ...empty,
      milestones: { count: 28, optedInNames: ["A", "B", "C", "D", "E"] },
    });
    expect(recap!.lines[0]).toBe(
      "28 milestones celebrated — A, B, C and 2 others",
    );
  });

  it("uses singular wording for one item", () => {
    const recap = buildCultureRecap({
      ...empty,
      milestones: { count: 1, optedInNames: [] },
    });
    expect(recap!.lines[0]).toBe("1 milestone celebrated");
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
      "3 Side Quests completed this week",
      "Live side quests: Lunch and learn · Tidy the kitchen",
    ]);
  });
});
