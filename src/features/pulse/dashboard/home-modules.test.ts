import { describe, expect, it } from "vitest";
import { sanitiseHomeModules } from "./home-modules";

describe("sanitiseHomeModules", () => {
  it("keeps only known modules in catalogue order without duplicates", () => {
    expect(
      sanitiseHomeModules(["goals", "rewards", "goals", "queue", "drop table"]),
    ).toEqual(["rewards", "goals"]);
  });

  it("never accepts the action queue as a module", () => {
    expect(sanitiseHomeModules(["daily_log", "employee_queue"])).toEqual([]);
  });

  it("returns nothing for non-array input", () => {
    expect(sanitiseHomeModules("rewards")).toEqual([]);
    expect(sanitiseHomeModules(null)).toEqual([]);
  });
});
