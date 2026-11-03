export type CultureSpotlight = {
  kind: "recognition" | "reward";
  title: string;
  description: string;
  actionLabel: string;
  href: string;
};

export type CultureSignals = {
  /** Public recognition received in the last 7 days. */
  recentRecognition: { count: number; latestAt: Date } | null;
  /** Reward wallet balance and the cheapest active reward on offer. */
  rewards: { balance: number; cheapestCost: number } | null;
};

const RECENT_MS = 7 * 86_400_000;

/**
 * Chooses the single most relevant culture card for the employee, or null
 * when there is nothing to show. Empty placeholders are never returned.
 */
export function pickCultureSpotlight(
  signals: CultureSignals,
  now: Date,
): CultureSpotlight | null {
  const recognition = signals.recentRecognition;
  if (
    recognition &&
    now.getTime() - recognition.latestAt.getTime() <= RECENT_MS
  ) {
    return {
      kind: "recognition",
      title:
        recognition.count === 1
          ? "You received recognition"
          : `You received ${recognition.count} recognitions`,
      description: "Teammates appreciated your work this week.",
      actionLabel: "View recognition",
      href: "/pulse/feedback",
    };
  }

  const rewards = signals.rewards;
  if (rewards && rewards.balance >= rewards.cheapestCost) {
    return {
      kind: "reward",
      title: "A reward is ready to redeem",
      description: `You have ${rewards.balance} points, enough for an available reward.`,
      actionLabel: "Browse rewards",
      href: "/pulse/rewards",
    };
  }

  return null;
}
