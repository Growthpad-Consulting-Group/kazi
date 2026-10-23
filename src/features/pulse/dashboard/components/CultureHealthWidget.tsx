import { Icon } from "@iconify/react";
import { supabaseAdmin } from "@/lib/supabase";

type Status = "green" | "yellow" | "red";

interface Indicator {
  label: string;
  detail: string;
  status: Status;
  icon: string;
}

const statusStyles: Record<Status, { chip: string; dot: string }> = {
  green:  { chip: "bg-emerald-500/10 text-emerald-600", dot: "bg-emerald-500" },
  yellow: { chip: "bg-amber-500/10 text-amber-600",    dot: "bg-amber-500"   },
  red:    { chip: "bg-red-500/10 text-red-500",         dot: "bg-red-500"     },
};

const statusLabel: Record<Status, string> = {
  green:  "Healthy",
  yellow: "Watch",
  red:    "Needs attention",
};

export default async function CultureHealthWidget() {
  const now = new Date();
  const ago30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const ago14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const ago7  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000).toISOString();
  const nowISO = now.toISOString();

  const [
    activeStaffRes,
    distinctGiversRes,
    allValuesRes,
    usedValueIdsRes,
    liveCampaignsRes,
    recentRecognitionCampaignIdsRes,
    allDepartmentsRes,
    recentCheckinDeptRes,
  ] = await Promise.all([
    // 1. Active staff count
    supabaseAdmin.from("users").select("id", { count: "exact", head: true }).eq("is_active", true),

    // 2. Recognition givers in last 30 days (distinct from_user_id from public feedback)
    supabaseAdmin.from("feedback").select("from_user_id").eq("visibility", "public").gte("created_at", ago30),

    // 3. All active recognition values
    supabaseAdmin.from("recognition_values").select("id, name").eq("is_active", true),

    // 4. Value IDs used in recognitions last 30 days
    supabaseAdmin.from("feedback").select("value_id").eq("visibility", "public").gte("created_at", ago30).not("value_id", "is", null),

    // 5. Live campaigns (starts_at <= now <= ends_at)
    supabaseAdmin.from("recognition_campaigns").select("id, name").eq("status", "live").lte("starts_at", nowISO).gte("ends_at", nowISO),

    // 6. Campaign IDs that have had at least 1 recognition in last 7 days
    supabaseAdmin.from("feedback").select("campaign_id").eq("visibility", "public").gte("created_at", ago7).not("campaign_id", "is", null),

    // 7. All departments from active users
    supabaseAdmin.from("users").select("department").eq("is_active", true).not("department", "is", null),

    // 8. Distinct departments that have submitted checkins in last 14 days (via users join)
    supabaseAdmin.from("checkins").select("user:users(department)").gte("created_at", ago14),
  ]);

  // ── 1. Active staff ─────────────────────────────────────────────────────────
  const activeCount = activeStaffRes.count ?? 0;

  // ── 2. Recognition participation ────────────────────────────────────────────
  const giversRows = distinctGiversRes.data ?? [];
  const distinctGivers = new Set(giversRows.map((r) => r.from_user_id)).size;
  const participationRate = activeCount > 0 ? Math.round((distinctGivers / activeCount) * 100) : 0;
  const participationStatus: Status = participationRate >= 50 ? "green" : participationRate >= 25 ? "yellow" : "red";
  const participationIndicator: Indicator = {
    label: "Recognition participation",
    detail: `${participationRate}% of staff gave recognition (last 30 days)`,
    status: participationStatus,
    icon: "solar:star-fall-broken",
  };

  // ── 3. Neglected values ─────────────────────────────────────────────────────
  const allValues = allValuesRes.data ?? [];
  const usedValueIds = new Set((usedValueIdsRes.data ?? []).map((r) => r.value_id).filter(Boolean));
  const neglectedValues = allValues.filter((v) => !usedValueIds.has(v.id));
  const neglectedStatus: Status = neglectedValues.length === 0 ? "green" : neglectedValues.length <= 2 ? "yellow" : "red";
  const neglectedIndicator: Indicator = {
    label: "Neglected values",
    detail: neglectedValues.length === 0
      ? "All recognition values used recently"
      : `${neglectedValues.length} value${neglectedValues.length === 1 ? "" : "s"} not used: ${neglectedValues.slice(0, 3).map((v) => v.name).join(", ")}`,
    status: neglectedStatus,
    icon: "solar:heart-broken",
  };

  // ── 4. Campaign drop-off ─────────────────────────────────────────────────────
  const liveCampaigns = liveCampaignsRes.data ?? [];
  const activeCampaignIds = new Set(
    (recentRecognitionCampaignIdsRes.data ?? []).map((r) => r.campaign_id).filter(Boolean)
  );
  const dropOffCampaigns = liveCampaigns.filter((c) => !activeCampaignIds.has(c.id));
  const dropOffStatus: Status = dropOffCampaigns.length === 0 ? "green" : dropOffCampaigns.length === 1 ? "yellow" : "red";
  const dropOffIndicator: Indicator = {
    label: "Campaign drop-off",
    detail: dropOffCampaigns.length === 0
      ? "All live campaigns have recent recognition"
      : `${dropOffCampaigns.length} campaign${dropOffCampaigns.length === 1 ? "" : "s"} with no activity: ${dropOffCampaigns.slice(0, 2).map((c) => c.name).join(", ")}`,
    status: dropOffStatus,
    icon: "solar:flag-broken",
  };

  // ── 5. Teams needing follow-up ───────────────────────────────────────────────
  const allDepts = [
    ...new Set(
      (allDepartmentsRes.data ?? [])
        .map((r) => r.department)
        .filter((d): d is string => typeof d === "string" && d.length > 0)
    ),
  ];

  type CheckinWithUser = { user: { department: string | null } | null };
  const recentCheckinRows = (recentCheckinDeptRes.data ?? []) as unknown as CheckinWithUser[];
  const deptsWithCheckins = new Set(
    recentCheckinRows
      .map((r) => r.user?.department)
      .filter((d): d is string => typeof d === "string" && d.length > 0)
  );
  const neglectedDepts = allDepts.filter((d) => !deptsWithCheckins.has(d));
  const followUpStatus: Status = neglectedDepts.length === 0 ? "green" : neglectedDepts.length <= 2 ? "yellow" : "red";
  const followUpIndicator: Indicator = {
    label: "Teams needing follow-up",
    detail: neglectedDepts.length === 0
      ? "All teams have recent check-ins"
      : `${neglectedDepts.length} team${neglectedDepts.length === 1 ? "" : "s"} with no check-ins: ${neglectedDepts.slice(0, 3).join(", ")}`,
    status: followUpStatus,
    icon: "solar:users-group-two-rounded-broken",
  };

  const indicators: Indicator[] = [
    participationIndicator,
    neglectedIndicator,
    dropOffIndicator,
    followUpIndicator,
  ];

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
          <Icon icon="solar:pulse-broken" className="h-3.5 w-3.5" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-hi)]">Culture health</h2>
          <p className="text-xs text-[var(--text-lo)]">{activeCount} active staff · live pulse indicators</p>
        </div>
      </div>

      <div className="space-y-3">
        {indicators.map((indicator) => {
          const styles = statusStyles[indicator.status];
          return (
            <div
              key={indicator.label}
              className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--text-lo)]">
                <Icon icon={indicator.icon} className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--text-hi)]">{indicator.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-lo)]">{indicator.detail}</p>
              </div>
              <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${styles.chip}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
                {statusLabel[indicator.status]}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
