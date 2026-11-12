import { Avatar } from "@/components/ui/Avatar";
import type { Staff, Winner } from "./wall-of-fame-model";
import type { WallOfFameCategory } from "@/lib/wall-of-fame-category-rules";

/** Published winners with prize tracking. Everyone sees the list; only managers change prize status. */
export default function WallOfFameWinners({
  categories,
  winners,
  staff,
  canManage,
  saving,
  onUpdatePrizeStatus,
}: {
  categories: WallOfFameCategory[];
  winners: Winner[];
  staff: Staff[];
  canManage: boolean;
  saving: boolean;
  onUpdatePrizeStatus: (
    winnerId: string,
    status: Winner["prize_status"],
  ) => void;
}) {
  if (winners.length === 0) return null;
  return (
    <>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-[var(--text-hi)]">
            Published winners
          </h2>
          <p className="mt-1 text-xs text-[var(--text-lo)]">
            Celebrate the winning work and keep prize fulfilment visible.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {winners.map((winner) => {
            const member = staff.find(
              (candidate) => candidate.id === winner.nominee_id,
            );
            if (!member) return null;
            return (
              <div
                key={winner.id}
                className="flex items-center gap-3 rounded-xl bg-[var(--surface-2)] p-3"
              >
                <Avatar name={member.name} src={member.avatar_url} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--text-hi)]">
                    {member.name}
                  </p>
                  <p className="text-xs text-[var(--text-lo)]">
                    {categories.find((item) => item.key === winner.category)
                      ?.label ?? winner.category}
                  </p>
                </div>
                {canManage ? (
                  <select
                    value={winner.prize_status}
                    disabled={saving}
                    onChange={(event) =>
                      onUpdatePrizeStatus(
                        winner.id,
                        event.target.value as Winner["prize_status"],
                      )
                    }
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs font-semibold text-[var(--text-hi)] outline-none focus:border-brand-500"
                  >
                    <option value="pending">Prize pending</option>
                    <option value="ordered">Prize ordered</option>
                    <option value="delivered">Prize delivered</option>
                  </select>
                ) : (
                  <span className="rounded-lg bg-emerald-500/10 px-2 py-1 text-xs font-semibold capitalize text-emerald-700 dark:text-emerald-300">
                    {winner.prize_status}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
