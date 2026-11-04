import { describe, expect, it } from "vitest";
import { isOverLimit, summariseDeliveries } from "./slack-admin";

describe("summariseDeliveries", () => {
  it("counts statuses per category and ranks the most common reasons", () => {
    const [mention, review] = summariseDeliveries([
      { category: "mention", status: "delivered", error: null },
      {
        category: "mention",
        status: "suppressed",
        error: "Recipient quiet hours",
      },
      {
        category: "mention",
        status: "suppressed",
        error: "Recipient quiet hours",
      },
      { category: "mention", status: "failed", error: null },
      { category: "review_open", status: "delivered", error: null },
    ]);
    expect(mention).toEqual({
      category: "mention",
      delivered: 1,
      suppressed: 2,
      failed: 1,
      reasons: [
        { reason: "Recipient quiet hours", count: 2 },
        { reason: "No reason recorded", count: 1 },
      ],
    });
    expect(review.reasons).toEqual([]);
  });

  it("truncates long reasons", () => {
    const [summary] = summariseDeliveries([
      { category: "x", status: "failed", error: "a".repeat(300) },
    ]);
    expect(summary.reasons[0].reason).toHaveLength(120);
  });
});

describe("isOverLimit", () => {
  it("blocks at and above the limit", () => {
    expect(isOverLimit(119, 120)).toBe(false);
    expect(isOverLimit(120, 120)).toBe(true);
  });
});
