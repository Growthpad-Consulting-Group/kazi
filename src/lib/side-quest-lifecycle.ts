type QuestSchedule = {
  status: "draft" | "upcoming" | "live" | "closed" | "archived";
  starts_at: string | null;
  ends_at: string | null;
};

/**
 * The scheduled worker persists lifecycle changes and sends notifications.
 * This fallback keeps the staff experience correct if that worker is delayed.
 */
export function effectiveSideQuestStatus<T extends QuestSchedule>(
  quest: T,
  now = new Date(),
): T["status"] {
  if (
    quest.status === "upcoming" &&
    quest.starts_at &&
    new Date(quest.starts_at) <= now &&
    (!quest.ends_at || new Date(quest.ends_at) >= now)
  )
    return "live" as T["status"];
  if (quest.status === "live" && quest.ends_at && new Date(quest.ends_at) < now)
    return "closed" as T["status"];
  return quest.status;
}

export function isSideQuestOpen<T extends QuestSchedule>(
  quest: T,
  now = new Date(),
) {
  return effectiveSideQuestStatus(quest, now) === "live";
}
