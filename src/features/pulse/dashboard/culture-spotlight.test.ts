import { describe, expect, it } from "vitest";
import { pickCultureSpotlight } from "./culture-spotlight";

const now = new Date("2026-11-03T09:00:00Z");
const DAY = 86_400_000;

describe("pickCultureSpotlight", () => {
  it("returns null when nothing is relevant", () => {
    expect(
      pickCultureSpotlight({ recentRecognition: null, rewards: null }, now),
    ).toBeNull();
  });

  it("shows recent recognition first", () => {
    const card = pickCultureSpotlight(
      {
        recentRecognition: {
          count: 2,
          latestAt: new Date(now.getTime() - DAY),
        },
        rewards: { balance: 500, cheapestCost: 100 },
      },
      now,
    );
    expect(card?.kind).toBe("recognition");
    expect(card?.title).toBe("You received 2 recognitions");
  });

  it("ignores recognition older than a week", () => {
    const card = pickCultureSpotlight(
      {
        recentRecognition: {
          count: 1,
          latestAt: new Date(now.getTime() - 10 * DAY),
        },
        rewards: null,
      },
      now,
    );
    expect(card).toBeNull();
  });

  it("shows a reward only when the balance covers the cheapest item", () => {
    expect(
      pickCultureSpotlight(
        {
          recentRecognition: null,
          rewards: { balance: 80, cheapestCost: 100 },
        },
        now,
      ),
    ).toBeNull();
    expect(
      pickCultureSpotlight(
        {
          recentRecognition: null,
          rewards: { balance: 120, cheapestCost: 100 },
        },
        now,
      )?.kind,
    ).toBe("reward");
  });
});
