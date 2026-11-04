// Builds the payload for a task created from a Kazi commitment. The task carries
// the action text and one Kazi link. It never copies meeting notes, mood,
// blockers, feedback or any other private record.

export type CreateTaskInput = {
  actionText: string;
  appUrl: string;
  sourcePath: string;
  workspaceGid: string;
  projectGid: string;
  assigneeGid: string;
  dueOn: string | null;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const GID = /^\d{1,20}$/;

export function validateTaskRequest(input: {
  projectGid: unknown;
  dueOn: unknown;
}):
  | { ok: true; projectGid: string; dueOn: string | null }
  | { ok: false; error: string } {
  if (typeof input.projectGid !== "string" || !GID.test(input.projectGid))
    return { ok: false, error: "Choose a project." };
  if (input.dueOn !== null && input.dueOn !== undefined) {
    if (typeof input.dueOn !== "string" || !DATE.test(input.dueOn))
      return { ok: false, error: "Use a valid due date." };
  }
  return {
    ok: true,
    projectGid: input.projectGid,
    dueOn: typeof input.dueOn === "string" ? input.dueOn : null,
  };
}

export function buildAsanaTaskPayload(input: CreateTaskInput) {
  const name = input.actionText.replace(/\s+/g, " ").trim().slice(0, 200);
  return {
    data: {
      workspace: input.workspaceGid,
      projects: [input.projectGid],
      name,
      notes: `Created from a Kazi commitment.\n${input.appUrl}${input.sourcePath}`,
      assignee: input.assigneeGid,
      ...(input.dueOn ? { due_on: input.dueOn } : {}),
    },
  };
}
