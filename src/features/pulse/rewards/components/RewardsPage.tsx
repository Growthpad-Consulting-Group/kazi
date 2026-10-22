import { redirect } from "next/navigation";
import { Icon } from "@iconify/react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import SetPageHeader from "@/components/ui/SetPageHeader";
import StatCard from "@/components/ui/StatCard";
import RedeemButton from "./RedeemButton";
import RedemptionActions from "./RedemptionActions";
import type { RewardCatalogue, RewardRedemption, RedemptionStatus } from "@/types/database";

type RedemptionWithItem = RewardRedemption & { catalogue_name: string };
type PendingRedemption = RewardRedemption & { catalogue_name: string; user_name: string };

const STATUS_STYLES: Record<RedemptionStatus, string> = {
  pending:   "bg-amber-500/10 text-amber-600",
  approved:  "bg-blue-500/10 text-blue-600",
  fulfilled: "bg-emerald-500/10 text-emerald-600",
  rejected:  "bg-red-500/10 text-red-500",
};

export default async function RewardsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = session.user.id;
  const canManage = can(session.user.role, "manage_rewards");

  const [walletResult, catalogueResult, redemptionsResult, pendingResult] = await Promise.all([
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
  ]);

  const balance = walletResult.data?.balance ?? 0;
  const catalogue = (catalogueResult.data ?? []) as RewardCatalogue[];
  const myRedemptions = (redemptionsResult.data ?? []) as RewardRedemption[];
  const pendingRedemptions = ((pendingResult.data ?? []) as RewardRedemption[]);

  // Enrich my redemptions with catalogue names
  const catalogueMap = new Map(catalogue.map((item) => [item.id, item.name]));

  // For pending redemptions, also fetch user names
  let enrichedPending: PendingRedemption[] = [];
  if (canManage && pendingRedemptions.length) {
    const userIds = [...new Set(pendingRedemptions.map((r) => r.user_id))];
    const catalogueIds = [...new Set(pendingRedemptions.map((r) => r.catalogue_item_id))];
    const [usersRes, itemsRes] = await Promise.all([
      supabaseAdmin.from("users").select("id, name").in("id", userIds),
      supabaseAdmin.from("reward_catalogue").select("id, name").in("id", catalogueIds),
    ]);
    const userMap = new Map((usersRes.data ?? []).map((u) => [u.id, u.name]));
    const itemMap = new Map((itemsRes.data ?? []).map((i) => [i.id, i.name]));
    enrichedPending = pendingRedemptions.map((r) => ({
      ...r,
      catalogue_name: itemMap.get(r.catalogue_item_id) ?? "Unknown item",
      user_name: userMap.get(r.user_id) ?? "Staff member",
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
        description="Redeem your points for great perks"
        icon="solar:gift-broken"
      />

      <div className="mx-auto max-w-7xl space-y-6">
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
        </section>

        {/* Catalogue */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
              <Icon icon="solar:gift-broken" className="h-3.5 w-3.5" />
            </span>
            <h2 className="text-sm font-semibold text-[var(--text-hi)]">Reward catalogue</h2>
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
                  className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] overflow-hidden"
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
                  <div className="flex flex-1 flex-col gap-2 p-4">
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
                    <RedemptionActions redemptionId={r.id} />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
}
