import { describe, expect, it } from "vitest";
import {
  rankFollowThrough,
  type FollowThroughItem,
} from "./follow-through-rank";

function item(id: string, dueAt: string | null): FollowThroughItem {
  return {
    id,
    text: id,
    source: "Source",
    href: "/pulse/idps",
    dueAt: dueAt ? new Date(dueAt) : null,
  };
}

describe("rankFollowThrough", () => {
  it("puts dated commitments first, soonest first, then undated", () => {
    const { items } = rankFollowThrough([
      item("undated", null),
      item("later", "2026-11-20T23:59:59"),
      item("sooner", "2026-11-05T23:59:59"),
    ]);
    expect(items.map((i) => i.id)).toEqual(["sooner", "later", "undated"]);
  });

  it("limits the list but reports the full total", () => {
    const result = rankFollowThrough(
      [item("a", null), item("b", null), item("c", null), item("d", null)],
      2,
    );
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(4);
  });

  it("returns nothing when there are no commitments", () => {
    expect(rankFollowThrough([])).toEqual({ items: [], total: 0 });
  });
});
