import { describe, expect, it } from "vitest";
import { classifyOpenAsanaTasks } from "./asana-task-health-utils";

describe("classifyOpenAsanaTasks", () => {
  it("separates due-today and overdue assigned tasks without exposing details", () => {
    const result = classifyOpenAsanaTasks(
      [
        {
          gid: "today",
          name: "Prepare project update",
          due_on: "2026-11-04",
          projects: [{ gid: "project-1", name: "Growthpad" }],
        },
        {
          gid: "late",
          name: "Follow up with client",
          due_on: "2026-11-03",
          permalink_url: "https://app.asana.com/0/1/late",
        },
        {
          gid: "later",
          name: "Plan next sprint",
          due_on: "2026-11-05",
        },
      ],
      "2026-11-04",
    );

    expect(result.dueToday).toEqual([
      {
        id: "today",
        name: "Prepare project update",
        dueOn: "2026-11-04",
        project: "Growthpad",
        url: null,
      },
    ]);
    expect(result.overdue).toEqual([
      {
        id: "late",
        name: "Follow up with client",
        dueOn: "2026-11-03",
        project: null,
        url: "https://app.asana.com/0/1/late",
      },
    ]);
  });
});

describe("classifyBlockedAsanaTasks", () => {
  it("marks a task blocked only when a dependency is incomplete", async () => {
    const { classifyBlockedAsanaTasks } =
      await import("./asana-task-health-utils");
    const result = classifyBlockedAsanaTasks(
      [
        {
          gid: "a",
          name: "Waiting on API",
          due_on: null,
          dependencyIds: ["d1"],
        },
        {
          gid: "b",
          name: "Done dependency",
          due_on: null,
          dependencyIds: ["d2"],
        },
        { gid: "c", name: "No dependencies", due_on: null, dependencyIds: [] },
      ],
      new Set(["d1"]),
    );
    expect(result.map((item) => item.id)).toEqual(["a"]);
  });
});
