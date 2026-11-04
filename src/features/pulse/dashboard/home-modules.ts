// Optional home cards staff can choose. The action queue is not in this list:
// it is always shown first and can never be hidden.

export const HOME_MODULES = [
  {
    id: "rewards",
    label: "Rewards",
    description: "Your reward balance and a link to the catalogue.",
  },
  {
    id: "recognition",
    label: "Recognition",
    description: "Recognition you received in the last 30 days.",
  },
  {
    id: "goals",
    label: "Goals",
    description: "How many goals are open and how many are due this week.",
  },
  {
    id: "upcoming",
    label: "Upcoming 1-on-1s",
    description: "Your 1-on-1s in the next two weeks.",
  },
] as const;

export type HomeModuleId = (typeof HOME_MODULES)[number]["id"];

const MAX_MODULES = HOME_MODULES.length;

/** Keeps only known module ids, removes duplicates and preserves the catalogue order. */
export function sanitiseHomeModules(input: unknown): HomeModuleId[] {
  if (!Array.isArray(input)) return [];
  const requested = new Set(
    input.filter((value): value is string => typeof value === "string"),
  );
  return HOME_MODULES.map((module) => module.id)
    .filter((id) => requested.has(id))
    .slice(0, MAX_MODULES);
}
