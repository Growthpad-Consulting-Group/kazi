import {
  getAsanaAccessToken,
  loadCompletedAsanaTasks,
  type CompletedAsanaTask,
} from "@/lib/asana-completed-tasks";
import { shiftDate } from "@/features/pulse/dashboard/my-week";
import {
  classifyBlockedAsanaTasks,
  classifyOpenAsanaTasks,
  type AsanaOpenTask,
  type AsanaTaskHealthItem,
} from "@/lib/asana-task-health-utils";

export { classifyOpenAsanaTasks } from "@/lib/asana-task-health-utils";
export type { AsanaTaskHealthItem } from "@/lib/asana-task-health-utils";

const ASANA_API = "https://app.asana.com/api/1.0";
const BLOCKED_CANDIDATE_LIMIT = 25;
const DEPENDENCY_LOOKUP_LIMIT = 100;

export type AsanaTaskHealth = {
  dueToday: AsanaTaskHealthItem[];
  overdue: AsanaTaskHealthItem[];
  /** Open tasks that cannot start until another task is complete. */
  blocked: AsanaTaskHealthItem[];
  completedRecently: CompletedAsanaTask[];
};

export type AsanaTaskHealthResult =
  { connected: false } | { connected: true; health: AsanaTaskHealth };

/**
 * A minimal, staff-owned task-health snapshot. It uses only task title,
 * project, due date, completion state and Asana's own deep link; descriptions,
 * comments and attachments are never requested or persisted. Dependency
 * identifiers are read to decide whether work is blocked, and never displayed.
 */
export async function loadAsanaTaskHealth({
  userId,
  today,
  origin = "",
}: {
  userId: string;
  today: string;
  origin?: string;
}): Promise<AsanaTaskHealthResult> {
  const access = await getAsanaAccessToken({ userId, origin });
  if (!access.connected) return access;

  const tomorrow = shiftDate(today, 1);
  const query = new URLSearchParams({
    "assignee.any": "me",
    completed: "false",
    "due_on.before": tomorrow,
    sort_by: "due_date",
    sort_ascending: "true",
    limit: "30",
    opt_fields: "gid,name,due_on,permalink_url,projects.gid,projects.name",
  });
  const response = await fetch(
    `${ASANA_API}/workspaces/${access.workspaceGid}/tasks/search?${query}`,
    { headers: { Authorization: `Bearer ${access.accessToken}` } },
  );
  const payload = (await response.json().catch(() => null)) as {
    data?: AsanaOpenTask[];
    errors?: { message?: string }[];
  } | null;
  if (!response.ok)
    throw new Error(
      payload?.errors?.[0]?.message ?? "Asana could not load task health.",
    );

  const [completed, blocked] = await Promise.all([
    loadCompletedAsanaTasks({
      userId,
      rangeStart: shiftDate(today, -6),
      rangeDays: 7,
      origin,
    }),
    loadBlockedTasks(access.accessToken, access.workspaceGid),
  ]);
  const open = classifyOpenAsanaTasks(payload?.data ?? [], today);
  return {
    connected: true,
    health: {
      ...open,
      blocked,
      completedRecently: completed.connected ? completed.tasks : [],
    },
  };
}

async function asanaGet<T>(path: string, token: string): Promise<T | null> {
  try {
    const response = await fetch(`${ASANA_API}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const json = (await response.json().catch(() => null)) as {
      data?: T;
    } | null;
    return json?.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Open tasks assigned to the user that depend on other tasks, filtered to those
 * whose dependencies are still incomplete. Lookups that fail are treated as
 * not blocking, so the result under-reports rather than guessing.
 */
async function loadBlockedTasks(
  token: string,
  workspaceGid: string,
): Promise<AsanaTaskHealthItem[]> {
  const query = new URLSearchParams({
    "assignee.any": "me",
    completed: "false",
    sort_by: "modified_at",
    sort_ascending: "false",
    limit: String(BLOCKED_CANDIDATE_LIMIT),
    opt_fields: "gid,name,due_on,permalink_url,projects.gid,projects.name",
  });
  const open = await asanaGet<AsanaOpenTask[]>(
    `/workspaces/${workspaceGid}/tasks/search?${query}`,
    token,
  );
  if (!open?.length) return [];

  const candidates = await Promise.all(
    open.map(async (task) => {
      const deps =
        (await asanaGet<{ gid: string }[]>(
          `/tasks/${task.gid}/dependencies?opt_fields=gid`,
          token,
        )) ?? [];
      return { ...task, dependencyIds: deps.map((dep) => dep.gid) };
    }),
  );

  const dependencyIds = [
    ...new Set(candidates.flatMap((task) => task.dependencyIds)),
  ].slice(0, DEPENDENCY_LOOKUP_LIMIT);
  const states = await Promise.all(
    dependencyIds.map(async (id) => ({
      id,
      completed: (
        await asanaGet<{ completed: boolean }>(
          `/tasks/${id}?opt_fields=completed`,
          token,
        )
      )?.completed,
    })),
  );
  const incomplete = new Set(
    states
      .filter((state) => state.completed === false)
      .map((state) => state.id),
  );
  return classifyBlockedAsanaTasks(candidates, incomplete);
}
