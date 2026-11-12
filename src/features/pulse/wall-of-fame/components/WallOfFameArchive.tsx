import { Avatar } from "@/components/ui/Avatar";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { supabaseAdmin } from "@/lib/supabase";
import { monthLabel } from "./wall-of-fame-model";
import { loadWallOfFameCategories } from "@/lib/wall-of-fame-categories";

type ArchiveCycle = { id: string; month: string };
type ArchiveWinner = {
  id: string;
  cycle_id: string;
  nominee_id: string;
  category: string;
};
type ArchivePerson = {
  id: string;
  name: string;
  job_title: string | null;
  department: string | null;
  avatar_url: string | null;
};

const MAX_CYCLES = 24;

// Everyone signed in can read the archive. It shows who won and for what, never
// vote scores, prize status or the people who were nominated but did not win.
export default async function WallOfFameArchive() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed tables
  const db = supabaseAdmin as any;
  const { data: cycleRows } = await db
    .from("wall_of_fame_cycles")
    .select("id, month")
    .eq("status", "published")
    .order("month", { ascending: false })
    .limit(MAX_CYCLES);
  const cycles = (cycleRows ?? []) as ArchiveCycle[];
  const cycleIds = cycles.map((cycle) => cycle.id);

  const { data: winnerRows } = cycleIds.length
    ? await db
        .from("wall_of_fame_winners")
        .select("id, cycle_id, nominee_id, category")
        .in("cycle_id", cycleIds)
    : { data: [] };
  const winners = (winnerRows ?? []) as ArchiveWinner[];

  const personIds = [...new Set(winners.map((winner) => winner.nominee_id))];
  const { data: personRows } = personIds.length
    ? await supabaseAdmin
        .from("users")
        .select("id, name, job_title, department, avatar_url")
        .in("id", personIds)
    : { data: [] };
  const people = new Map(
    ((personRows ?? []) as ArchivePerson[]).map((person) => [
      person.id,
      person,
    ]),
  );

  // Past winners may have been in categories that are now retired, so read them all.
  const categories = await loadWallOfFameCategories({ includeRetired: true });
  const categoryLabel = (value: string) =>
    categories.find((option) => option.key === value)?.label ?? value;

  return (
    <div className="space-y-6">
      <SetPageHeader
        title="Wall of Fame archive"
        description="Past winners, newest first."
        icon="solar:cup-star-broken"
      />
      {cycles.length === 0 && (
        <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--text-lo)]">
          No winners have been published yet.
        </p>
      )}
      {cycles.map((cycle) => {
        const cycleWinners = winners.filter(
          (winner) => winner.cycle_id === cycle.id,
        );
        return (
          <section
            key={cycle.id}
            aria-labelledby={`archive-${cycle.id}`}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 dark:shadow-black/20"
          >
            <h2
              id={`archive-${cycle.id}`}
              className="mb-4 text-sm font-semibold text-[var(--text-hi)]"
            >
              {monthLabel(cycle.month)}
            </h2>
            {cycleWinners.length === 0 ? (
              <p className="text-xs text-[var(--text-lo)]">
                No winners recorded for this month.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {cycleWinners.map((winner) => {
                  const person = people.get(winner.nominee_id);
                  if (!person) return null;
                  return (
                    <li
                      key={winner.id}
                      className="flex items-center gap-3 rounded-xl bg-[var(--surface-2)] p-3"
                    >
                      <Avatar
                        name={person.name}
                        src={person.avatar_url}
                        size="md"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--text-hi)]">
                          {person.name}
                        </p>
                        <p className="truncate text-xs text-[var(--text-lo)]">
                          {categoryLabel(winner.category)}
                          {person.job_title ? ` · ${person.job_title}` : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
