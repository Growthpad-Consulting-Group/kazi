export type AsanaOpenTask = {
  gid: string;
  name: string;
  due_on: string | null;
  permalink_url?: string;
  projects?: { gid: string; name: string }[];
};

export type AsanaTaskHealthItem = {
  id: string;
  name: string;
  dueOn: string | null;
  project: string | null;
  url: string | null;
};

function toItem(task: AsanaOpenTask): AsanaTaskHealthItem {
  return {
    id: task.gid,
    name: task.name,
    dueOn: task.due_on,
    project: task.projects?.[0]?.name ?? null,
    url: task.permalink_url ?? null,
  };
}

export function classifyOpenAsanaTasks(
  tasks: AsanaOpenTask[],
  today: string,
): { dueToday: AsanaTaskHealthItem[]; overdue: AsanaTaskHealthItem[] } {
  const items = tasks.map(toItem);
  return {
    dueToday: items.filter((task) => task.dueOn === today),
    overdue: items.filter((task) => Boolean(task.dueOn && task.dueOn < today)),
  };
}

/**
 * A task is blocked when at least one of its dependencies is still incomplete.
 * Dependencies whose state is unknown are not treated as blocking, so a failed
 * lookup under-reports blockers rather than inventing them.
 */
export function classifyBlockedAsanaTasks(
  tasks: (AsanaOpenTask & { dependencyIds: string[] })[],
  incompleteDependencyIds: Set<string>,
): AsanaTaskHealthItem[] {
  return tasks
    .filter((task) =>
      task.dependencyIds.some((id) => incompleteDependencyIds.has(id)),
    )
    .map(toItem);
}
