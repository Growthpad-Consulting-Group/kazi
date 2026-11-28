import { describe, expect, it } from "vitest";
import { checkinMoodLabel } from "./checkin-mood";

describe("checkinMoodLabel", () => {
  it("names each point on the scale", () => {
    expect([1, 2, 3, 4, 5].map(checkinMoodLabel)).toEqual([
      "Struggling",
      "Low",
      "Okay",
      "Good",
      "Great",
    ]);
  });

  it("returns null when no mood was chosen", () => {
    expect(checkinMoodLabel(null)).toBeNull();
    expect(checkinMoodLabel(undefined)).toBeNull();
    expect(checkinMoodLabel(9)).toBeNull();
  });
});
