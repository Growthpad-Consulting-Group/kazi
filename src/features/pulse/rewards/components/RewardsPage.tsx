import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Icon } from "@iconify/react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import SetPageHeader from "@/components/ui/SetPageHeader";
import StatCard from "@/components/ui/StatCard";
import { Avatar } from "@/components/ui/Avatar";
import TabBar from "@/components/ui/TabBar";
import RedeemButton from "./RedeemButton";
import RedemptionActions from "./RedemptionActions";
import { AdminRewardTools, CatalogueManager, NewRewardButton } from "./AdminRewardTools";
import type { RewardCatalogue, RewardRedemption, RedemptionStatus } from "@/types/database";

type RedemptionWithItem = RewardRedemption & { catalogue_name: string };
type PendingRedemption = RewardRedemption & { catalogue_name: string; user_name: string; requester_role: string };

const STATUS_STYLES: Record<RedemptionStatus, string> = {
  pending:   "bg-amber-500/10 text-amber-600",
  approved:  "bg-blue-500/10 text-blue-600",
  fulfilled: "bg-emerald-500/10 text-emerald-600",
  rejected:  "bg-red-500/10 text-red-500",
};

export default async function RewardsPage({ tab }: { tab?: string }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = session.user.id;
  const canManage = can(session.user.role, "manage_rewards");
  const showingManage = canManage && tab === "manage";

  // Admins see what the automations and manual grants have awarded over the last week.
  const weekPoints = { total: 0, awards: 0, earners: [] as { name: string; points: number; avatarUrl: string | null }[] };
  if (canManage) {
    // eslint-disable-next-line react-hooks/purity -- server component; the window is fixed per request
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- reward_ledger is not in the generated types
    const { data: ledger } = await (supabaseAdmin as any).from("reward_ledger").select("user_id, amount").gt("amount", 0).gte("created_at", since);
    const rows = (ledger ?? []) as { user_id: string; amount: number }[];
    const byUser = new Map<string, number>();
    for (const row of rows) {
      weekPoints.total += row.amount;
      byUser.set(row.user_id, (byUser.get(row.user_id) ?? 0) + row.amount);
    }
    weekPoints.awards = rows.length;
    const top = [...byUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (top.length) {
      const ids = top.map(([id]) => id);
      const { data: people } = await supabaseAdmin.from("users").select("id, name, avatar_url").in("id", ids);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- signature_staff_profiles is not in the generated types
      const { data: signatures } = await (supabaseAdmin as any).from("signature_staff_profiles").select("user_id, photo_url").in("user_id", ids);
      const people_ = new Map(((people ?? []) as { id: string; name: string; avatar_url: string | null }[]).map((person) => [person.id, person]));
      const photos = new Map(((signatures ?? []) as { user_id: string | null; photo_url: string | null }[]).filter((row) => row.user_id && row.photo_url).map((row) => [row.user_id as string, row.photo_url as string]));
      weekPoints.earners = top.map(([id, points]) => {
        const person = people_.get(id);
        return { name: person?.name ?? "Unknown", points, avatarUrl: person?.avatar_url ?? photos.get(id) ?? null };
      });
    }
  }

  const [walletResult, catalogueResult, redemptionsResult, pendingResult, staffResult, manageCatalogueResult] = await Promise.all([
    supabaseAdmin.from("reward_wallets").select("balance").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("reward_catalogue").select("*").eq("is_active", true).order("points_cost", { ascending: true }),
    supabaseAdmin
      .from("reward_redemptions")
      .select("id, user_id, catalogue_item_id, points_spent, status, approved_by, fulfilled_at, notes, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    canManage
      ? supabaseAdmin
          .from("reward_redemptions")
          .select("id, user_id, catalogue_item_id, points_spent, status, approved_by, fulfilled_at, notes, created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
    canManage
      ? supabaseAdmin.from("users").select("id, name").eq("is_active", true).order("name")
      : Promise.resolve({ data: [] }),
    showingManage
      ? supabaseAdmin.from("reward_catalogue").select("*").order("is_active", { ascending: false }).order("points_cost", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);
  const staffOptions = ((staffResult.data ?? []) as { id: string; name: string }[]);

  const balance = walletResult.data?.balance ?? 0;
  const catalogue = (catalogueResult.data ?? []) as RewardCatalogue[];
  const myRedemptions = (redemptionsResult.data ?? []) as RewardRedemption[];
  const pendingRedemptions = ((pendingResult.data ?? []) as RewardRedemption[]);
  const manageCatalogue = (manageCatalogueResult.data ?? []) as RewardCatalogue[];

  // Enrich my redemptions with catalogue names
  const catalogueMap = new Map(catalogue.map((item) => [item.id, item.name]));

  // For pending redemptions, also fetch user names
  let enrichedPending: PendingRedemption[] = [];
  if (canManage && pendingRedemptions.length) {
    const userIds = [...new Set(pendingRedemptions.map((r) => r.user_id))];
    const catalogueIds = [...new Set(pendingRedemptions.map((r) => r.catalogue_item_id))];
    const [usersRes, itemsRes] = await Promise.all([
      supabaseAdmin.from("users").select("id, name, role").in("id", userIds),
      supabaseAdmin.from("reward_catalogue").select("id, name").in("id", catalogueIds),
    ]);
    const userMap = new Map((usersRes.data ?? []).map((u) => [u.id, u.name]));
    const roleMap = new Map(((usersRes.data ?? []) as { id: string; role?: string }[]).map((u) => [u.id, u.role ?? ""]));
    const itemMap = new Map((itemsRes.data ?? []).map((i) => [i.id, i.name]));
    enrichedPending = pendingRedemptions.map((r) => ({
      ...r,
      catalogue_name: itemMap.get(r.catalogue_item_id) ?? "Unknown item",
      user_name: userMap.get(r.user_id) ?? "Staff member",
      requester_role: roleMap.get(r.user_id) ?? "",
    }));
  }

  const myEnriched: RedemptionWithItem[] = myRedemptions.map((r) => ({
    ...r,
    catalogue_name: catalogueMap.get(r.catalogue_item_id) ?? "Unknown item",
  }));

  return (
    <>
      <SetPageHeader
        title="Rewards"
        description={showingManage ? "Create rewards, control availability, and keep redemption history intact." : "Redeem your points for great perks"}
        trailing={canManage ? (showingManage ? <NewRewardButton /> : <AdminRewardTools staff={staffOptions} />) : undefined}
        icon="solar:gift-broken"
      />

      <div className="mx-auto max-w-7xl space-y-6">
        {canManage && <Suspense><TabBar tabs={[{ id: "rewards", label: "Rewards", icon: "solar:gift-broken" }, { id: "manage", label: "Manage", icon: "solar:settings-broken" }]} /></Suspense>}
        {showingManage ? <CatalogueManager items={manageCatalogue} /> : <>
        {/* Balance */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            title="Your points"
            value={balance}
            icon="solar:star-broken"
            color="amber"
            compact
            subtitle="Available to redeem"
          />
          {canManage && (
            <>
              <StatCard title="Points awarded (7 days)" value={weekPoints.total} icon="solar:cup-star-broken" color="green" compact subtitle="All automations and grants" />
              <StatCard title="Awards (7 days)" value={weekPoints.awards} icon="solar:medal-ribbon-broken" color="blue" compact subtitle="Individual point awards" />
            </>
          )}
        </section>

        {canManage && (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                  <Icon icon="solar:cup-star-broken" className="h-4.5 w-4.5" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-[var(--text-hi)]">Top earners this week</h2>
                  <p className="mt-0.5 text-xs text-[var(--text-lo)]">Recognition points awarded in the last 7 days.</p>
                </div>
              </div>
              <span className="rounded-lg bg-[var(--surface-2)] px-2.5 py-1 font-mono text-[11px] font-semibold text-[var(--text-lo)]">{weekPoints.total} pts awarded</span>
            </div>
            {weekPoints.earners.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-4 py-6 text-center">
                <Icon icon="solar:medal-ribbon-broken" className="mx-auto h-5 w-5 text-[var(--text-lo)]" />
                <p className="mt-2 text-sm font-medium text-[var(--text-hi)]">No earners yet this week</p>
                <p className="mt-1 text-xs text-[var(--text-lo)]">Recognition and reward grants will appear here.</p>
              </div>
            ) : (
              <ol className="mt-4 space-y-2">
                {weekPoints.earners.map((earner, index) => (
                  <li key={`${earner.name}-${index}`} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${index === 0 ? "bg-amber-500/8 ring-1 ring-amber-500/15" : "bg-[var(--surface-2)]"}`}>
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold ${index === 0 ? "bg-amber-500 text-white shadow-sm shadow-amber-500/25" : "bg-[var(--surface)] text-[var(--text-lo)]"}`}>
                      {index === 0 ? <Icon icon="solar:cup-star-bold" className="h-4 w-4" /> : index + 1}
                    </span>
                    <Avatar name={earner.name} src={earner.avatarUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--text-hi)]">{earner.name}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--text-lo)]">{index === 0 ? "Leading this week" : `Ranked #${index + 1} this week`}</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-amber-500/10 px-2.5 py-1 font-mono text-xs font-bold text-amber-700 dark:text-amber-400">
                      <Icon icon="solar:star-bold" className="h-3.5 w-3.5" />
                      {earner.points} pts
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}

        {/* Catalogue */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                <Icon icon="solar:gift-broken" className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-hi)]">Reward catalogue</h2>
                <p className="mt-0.5 text-xs text-[var(--text-lo)]">Spend your available points on team perks and experiences.</p>
              </div>
            </div>
            <span className="rounded-lg bg-[var(--surface-2)] px-2.5 py-1 text-xs font-semibold text-[var(--text-lo)]">{catalogue.length} available</span>
          </div>

          {catalogue.length === 0 ? (
            <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] text-center px-4">
              <Icon icon="solar:gift-broken" className="h-6 w-6 text-[var(--text-lo)]" />
              <p className="mt-2 text-sm text-[var(--text-lo)]">No rewards available yet.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {catalogue.map((item) => (
                <div
                  key={item.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:shadow-black/15"
                >
                  {item.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="h-36 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-36 items-center justify-center bg-brand-500/5">
                      <Icon icon="solar:gift-broken" className="h-10 w-10 text-brand-500/40" />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col gap-2.5 p-4">
                    <p className="text-sm font-semibold text-[var(--text-hi)]">{item.name}</p>
                    {item.description && (
                      <p className="line-clamp-2 text-xs text-[var(--text-lo)]">{item.description}</p>
                    )}
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600">
                        <Icon icon="solar:star-broken" className="h-3 w-3" />
                        {item.points_cost} pts
                      </span>
                      <RedeemButton
                        catalogueItemId={item.id}
                        pointsCost={item.points_cost}
                        userBalance={balance}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* My redemption history */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
              <Icon icon="solar:history-broken" className="h-3.5 w-3.5" />
            </span>
            <h2 className="text-sm font-semibold text-[var(--text-hi)]">Your redemptions</h2>
          </div>

          {myEnriched.length === 0 ? (
            <p className="text-sm text-[var(--text-lo)]">No redemptions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-xs font-semibold text-[var(--text-lo)]">
                    <th className="py-2 pr-4 text-left">Item</th>
                    <th className="py-2 pr-4 text-left">Points</th>
                    <th className="py-2 pr-4 text-left">Status</th>
                    <th className="py-2 text-left">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {myEnriched.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2.5 pr-4 font-medium text-[var(--text-hi)]">{r.catalogue_name}</td>
                      <td className="py-2.5 pr-4 font-mono text-[var(--text-lo)]">{r.points_spent}</td>
                      <td className="py-2.5 pr-4">
                        <span className={`rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[r.status]}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-xs text-[var(--text-lo)]">
                        {new Date(r.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* HR: Pending redemptions */}
        {canManage && (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                <Icon icon="solar:inbox-broken" className="h-3.5 w-3.5" />
              </span>
              <h2 className="text-sm font-semibold text-[var(--text-hi)]">Pending redemptions</h2>
              {enrichedPending.length > 0 && (
                <span className="ml-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600">
                  {enrichedPending.length}
                </span>
              )}
            </div>

            {enrichedPending.length === 0 ? (
              <p className="text-sm text-[var(--text-lo)]">No pending redemptions.</p>
            ) : (
              <div className="space-y-3">
                {enrichedPending.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-hi)]">{r.user_name}</p>
                      <p className="mt-0.5 text-xs text-[var(--text-lo)]">
                        {r.catalogue_name} &middot; {r.points_spent} pts &middot;{" "}
                        {new Date(r.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    {r.user_id === userId || (r.requester_role === "admin" && session.user.role !== "hr") ? (
                      <span className="text-xs text-[var(--text-lo)]">{r.user_id === userId ? "Waiting for another admin or HR" : "Waiting for HR"}</span>
                    ) : (
                      <RedemptionActions redemptionId={r.id} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
        </>}
      </div>
    </>
  );
}
