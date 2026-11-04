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

export function classifyOpenAsanaTasks(
  tasks: AsanaOpenTask[],
  today: string,
): { dueToday: AsanaTaskHealthItem[]; overdue: AsanaTaskHealthItem[] } {
  const items = tasks.map((task) => ({
    id: task.gid,
    name: task.name,
    dueOn: task.due_on,
    project: task.projects?.[0]?.name ?? null,
    url: task.permalink_url ?? null,
  }));
  return {
    dueToday: items.filter((task) => task.dueOn === today),
    overdue: items.filter((task) => Boolean(task.dueOn && task.dueOn < today)),
  };
}
