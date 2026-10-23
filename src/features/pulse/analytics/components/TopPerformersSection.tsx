"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";

export interface TopPerformerEntry {
  id: string;
  name: string;
  department: string | null;
  score: number;
  /** Display label for the score, e.g. "120 pts" or "83%" or "4.5 / 5" */
  scoreLabel: string;
}

interface TopPerformersSectionProps {
  rewardPoints: TopPerformerEntry[];
  goalCompletion: TopPerformerEntry[];
  reviewRatings: TopPerformerEntry[];
}

type Tab = "rewardPoints" | "goalCompletion" | "reviewRatings";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "rewardPoints",  label: "Reward points",    icon: "solar:gift-broken" },
  { key: "goalCompletion", label: "Goal completion", icon: "solar:target-broken" },
  { key: "reviewRatings", label: "Review ratings",   icon: "solar:clipboard-list-broken" },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sizeClass =
    size === "lg" ? "h-14 w-14 text-base"
    : size === "md" ? "h-12 w-12 text-sm"
    : "h-9 w-9 text-xs";
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full bg-brand-500/10 font-bold text-brand-500 ${sizeClass}`}>
      {initials(name)}
    </span>
  );
}

type PodiumEntry = { entry: TopPerformerEntry; rank: 1 | 2 | 3 };

function PodiumCard({ entry, rank }: PodiumEntry) {
  const ringColor = rank === 1 ? "ring-amber-400" : rank === 2 ? "ring-slate-400" : "ring-orange-700";
  const bgColor   = rank === 1 ? "bg-amber-500/15" : rank === 2 ? "bg-slate-400/15" : "bg-orange-700/15";
  const medal     = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
  const avatarSize = rank === 1 ? "lg" : "md";

  return (
    <div className={`flex flex-col items-center gap-2 rounded-2xl border border-[var(--border)] px-4 py-5 ${bgColor} ${rank === 1 ? "scale-105 shadow-xl shadow-amber-500/10" : ""}`}>
      <span className="text-xl">{medal}</span>
      <span className={`ring-2 ${ringColor} rounded-full`}>
        <Avatar name={entry.name} size={avatarSize as "lg" | "md"} />
      </span>
      <div className="text-center">
        <p className="text-sm font-semibold text-[var(--text-hi)]">{entry.name}</p>
        {entry.department && (
          <p className="text-xs text-[var(--text-lo)]">{entry.department}</p>
        )}
      </div>
      <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 font-mono text-xs font-bold text-brand-500">
        {entry.scoreLabel}
      </span>
    </div>
  );
}

export default function TopPerformersSection({
  rewardPoints,
  goalCompletion,
  reviewRatings,
}: TopPerformersSectionProps) {
  const [activeTab, setActiveTab] = useState<Tab>("rewardPoints");

  const listMap: Record<Tab, TopPerformerEntry[]> = { rewardPoints, goalCompletion, reviewRatings };
  const list = listMap[activeTab];

  if (rewardPoints.length === 0 && goalCompletion.length === 0 && reviewRatings.length === 0) {
    return null;
  }

  const top3 = list.slice(0, 3);
  const rest = list.slice(3, 10);

  // Podium order: 2nd, 1st, 3rd
  const podiumOrder: PodiumEntry[] = top3[1]
    ? [
        { entry: top3[1], rank: 2 },
        ...(top3[0] ? [{ entry: top3[0], rank: 1 as const }] : []),
        ...(top3[2] ? [{ entry: top3[2], rank: 3 as const }] : []),
      ]
    : top3.map((entry, i) => ({ entry, rank: (i + 1) as 1 | 2 | 3 }));

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/50 hover:shadow-2xl dark:shadow-black/20 transition-all duration-300">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-6 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
          <Icon icon="solar:medal-ribbon-broken" className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-md font-semibold text-[var(--text-hi)]">Top Performers</h3>
          <p className="text-xs text-[var(--text-lo)]">Top 10 by performance metric</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)] px-4 pt-3">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`inline-flex items-center gap-1.5 rounded-t-lg px-3 pb-2.5 pt-1 text-xs font-semibold transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-brand-500 text-brand-500"
                : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
            }`}
          >
            <Icon icon={tab.icon} className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-6">
        {list.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--text-lo)]">No data available for this metric yet.</p>
        ) : (
          <div className="space-y-6">
            {/* Podium */}
            {top3.length > 0 && (
              <div className="flex items-end justify-center gap-4">
                {podiumOrder.map(({ entry, rank }) => (
                  <div
                    key={entry.id}
                    className={`w-full max-w-[160px] ${rank === 1 ? "self-start" : ""}`}
                  >
                    <PodiumCard entry={entry} rank={rank} />
                    <div className={`mx-auto rounded-b-xl bg-[var(--surface-2)] ${rank === 1 ? "h-10" : rank === 2 ? "h-6" : "h-3"}`} />
                  </div>
                ))}
              </div>
            )}

            {/* Ranked list 4–10 */}
            {rest.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                <ol className="divide-y divide-[var(--border)]">
                  {rest.map((entry, index) => (
                    <li key={entry.id} className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--surface-2)] transition-colors">
                      <span className="w-6 shrink-0 font-mono text-xs font-bold text-[var(--text-lo)]">
                        {index + 4}
                      </span>
                      <Avatar name={entry.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--text-hi)]">{entry.name}</p>
                        {entry.department && (
                          <p className="truncate text-xs text-[var(--text-lo)]">{entry.department}</p>
                        )}
                      </div>
                      <span className="shrink-0 font-mono text-xs font-bold text-brand-500">
                        {entry.scoreLabel}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
