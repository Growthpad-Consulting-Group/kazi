import { describe, expect, it } from "vitest";
import {
  buildAsanaTaskPayload,
  validateTaskRequest,
} from "./asana-task-create";

describe("validateTaskRequest", () => {
  it("accepts a numeric project and an optional due date", () => {
    expect(
      validateTaskRequest({ projectGid: "1200", dueOn: "2026-11-10" }),
    ).toEqual({
      ok: true,
      projectGid: "1200",
      dueOn: "2026-11-10",
    });
    expect(
      validateTaskRequest({ projectGid: "1200", dueOn: null }),
    ).toMatchObject({
      ok: true,
      dueOn: null,
    });
  });

  it("rejects malformed project ids and dates", () => {
    expect(validateTaskRequest({ projectGid: "../x", dueOn: null }).ok).toBe(
      false,
    );
    expect(
      validateTaskRequest({ projectGid: "12", dueOn: "10/11/2026" }).ok,
    ).toBe(false);
  });
});

describe("buildAsanaTaskPayload", () => {
  const base = {
    actionText: "  Share the   onboarding plan  ",
    appUrl: "https://kazi.example",
    sourcePath: "/pulse/one-on-ones/abc",
    workspaceGid: "9",
    projectGid: "1200",
    assigneeGid: "77",
    dueOn: "2026-11-10",
  };

  it("uses the tidied action text and includes only a Kazi link as context", () => {
    const { data } = buildAsanaTaskPayload(base);
    expect(data.name).toBe("Share the onboarding plan");
    expect(data.notes).toBe(
      "Created from a Kazi commitment.\nhttps://kazi.example/pulse/one-on-ones/abc",
    );
    expect(data.due_on).toBe("2026-11-10");
    expect(data.assignee).toBe("77");
  });

  it("omits the due date when none was chosen and caps long names", () => {
    const { data } = buildAsanaTaskPayload({
      ...base,
      dueOn: null,
      actionText: "x".repeat(300),
    });
    expect(data.name).toHaveLength(200);
    expect(data).not.toHaveProperty("due_on");
  });
});
