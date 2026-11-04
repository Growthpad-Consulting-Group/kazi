import {
  getAsanaAccessToken,
  loadCompletedAsanaTasks,
  type CompletedAsanaTask,
} from "@/lib/asana-completed-tasks";
import { shiftDate } from "@/features/pulse/dashboard/my-week";
import {
  classifyOpenAsanaTasks,
  type AsanaOpenTask,
  type AsanaTaskHealthItem,
} from "@/lib/asana-task-health-utils";

export { classifyOpenAsanaTasks } from "@/lib/asana-task-health-utils";
export type { AsanaTaskHealthItem } from "@/lib/asana-task-health-utils";

export type AsanaTaskHealth = {
  dueToday: AsanaTaskHealthItem[];
  overdue: AsanaTaskHealthItem[];
  completedRecently: CompletedAsanaTask[];
};

export type AsanaTaskHealthResult =
  { connected: false } | { connected: true; health: AsanaTaskHealth };

/**
 * A minimal, staff-owned task-health snapshot. It uses only task title,
 * project, due date, completion state and Asana's own deep link; descriptions,
 * comments and attachments are never requested or persisted.
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
    `https://app.asana.com/api/1.0/workspaces/${access.workspaceGid}/tasks/search?${query}`,
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

  const completed = await loadCompletedAsanaTasks({
    userId,
    rangeStart: shiftDate(today, -6),
    rangeDays: 7,
    origin,
  });
  const open = classifyOpenAsanaTasks(payload?.data ?? [], today);
  return {
    connected: true,
    health: {
      ...open,
      completedRecently: completed.connected ? completed.tasks : [],
    },
  };
}
