import Link from "next/link";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { getWalkOfFameData, type WalkOfFameEntry } from "../data";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function Avatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg"
      ? "h-14 w-14 text-base"
      : size === "md"
        ? "h-12 w-12 text-sm"
        : "h-9 w-9 text-xs";
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-brand-500/10 font-bold text-brand-500 ${sizeClass}`}
    >
      {initials(name)}
    </span>
  );
}

type PodiumPosition = {
  entry: WalkOfFameEntry;
  rank: 1 | 2 | 3;
};

function PodiumCard({ entry, rank }: PodiumPosition) {
  const ringColor =
    rank === 1
      ? "ring-amber-400"
      : rank === 2
        ? "ring-slate-400"
        : "ring-orange-700";
  const bgColor =
    rank === 1
      ? "bg-amber-500/15"
      : rank === 2
        ? "bg-slate-400/15"
        : "bg-orange-700/15";
  const label =
    rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
  const avatarSize = rank === 1 ? "lg" : "md";

  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-2xl border border-[var(--border)] px-4 py-5 ${bgColor} ${rank === 1 ? "scale-105 shadow-xl shadow-amber-500/10" : ""}`}
    >
      <span className="text-xl">{label}</span>
      <span className={`ring-2 ${ringColor} rounded-full`}>
        <Avatar name={entry.name} size={avatarSize as "lg" | "md" | "sm"} />
      </span>
      <div className="text-center">
        <p className="text-sm font-semibold text-[var(--text-hi)]">{entry.name}</p>
        {entry.department && (
          <p className="text-xs text-[var(--text-lo)]">{entry.department}</p>
        )}
      </div>
      <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 font-mono text-xs font-bold text-brand-500">
        {entry.count} recognitions
      </span>
    </div>
  );
}

export default async function WalkOfFamePage() {
  const data = await getWalkOfFameData();

  const top3 = data.slice(0, 3) as WalkOfFameEntry[];
  const rest = data.slice(3);

  // Podium order: 2nd, 1st, 3rd
  const podiumOrder: PodiumPosition[] = top3[1]
    ? [
        { entry: top3[1], rank: 2 },
        ...(top3[0] ? [{ entry: top3[0], rank: 1 as const }] : []),
        ...(top3[2] ? [{ entry: top3[2], rank: 3 as const }] : []),
      ]
    : top3.map((entry, i) => ({ entry, rank: (i + 1) as 1 | 2 | 3 }));

  return (
    <>
      <SetPageHeader
        title="Walk of Fame"
        description="All-time recognition champions"
        icon="solar:cup-star-broken"
      />

      {data.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-5 text-center">
          <p className="text-sm font-semibold text-[var(--text-hi)]">No recognition data yet</p>
          <p className="mt-1 text-xs text-[var(--text-lo)]">
            Recognition champions will appear here once feedback starts flowing.
          </p>
        </div>
      ) : (
        <div className="mx-auto max-w-4xl space-y-8">
          {/* Podium — top 3 */}
          {top3.length > 0 && (
            <section>
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-[var(--text-lo)]">
                Top Champions
              </h2>
              <div className="flex items-end justify-center gap-4">
                {podiumOrder.map(({ entry, rank }) => (
                  <div
                    key={entry.id}
                    className={`w-full max-w-[180px] ${rank === 1 ? "self-start" : ""}`}
                  >
                    <PodiumCard entry={entry} rank={rank} />
                    {/* Pedestal height visual */}
                    <div
                      className={`mx-auto rounded-b-xl bg-[var(--surface-2)] ${
                        rank === 1 ? "h-10" : rank === 2 ? "h-6" : "h-3"
                      }`}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Ranked list — 4 through 20 */}
          {rest.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              <div className="border-b border-[var(--border)] px-5 py-4">
                <h2 className="text-sm font-semibold text-[var(--text-hi)]">Rankings</h2>
                <p className="mt-0.5 text-xs text-[var(--text-lo)]">Positions 4–20, all time</p>
              </div>
              <ol className="divide-y divide-[var(--border)]">
                {rest.map((entry, index) => (
                  <li key={entry.id} className="flex items-center gap-4 px-5 py-3">
                    <span className="w-6 shrink-0 font-mono text-xs font-bold text-[var(--text-lo)]">
                      {index + 4}
                    </span>
                    <Avatar name={entry.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--text-hi)]">
                        {entry.name}
                      </p>
                      {entry.department && (
                        <p className="truncate text-xs text-[var(--text-lo)]">
                          {entry.department}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {entry.tenureBadge && (
                        <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-xs font-semibold text-brand-500">
                          {entry.tenureBadge} service
                        </span>
                      )}
                      {entry.isRecent && (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                          Active
                        </span>
                      )}
                      <span className="font-mono text-xs font-bold text-brand-500">
                        {entry.count}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Footer link */}
          <div className="text-center">
            <Link
              href="/pulse/leaderboards"
              className="text-sm text-brand-500 hover:underline"
            >
              View 90-day leaderboards →
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
