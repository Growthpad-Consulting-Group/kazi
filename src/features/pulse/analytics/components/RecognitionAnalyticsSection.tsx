import { Icon } from "@iconify/react";
import { supabaseAdmin } from "@/lib/supabase";
import StatCard from "@/components/ui/StatCard";
import { SurveyDistributionChart } from "@/features/pulse/surveys/components/SurveyDistributionChart";
import { RecognitionTrendChart } from "./RecognitionTrendChart";

interface Props {
  since?: Date;
  departmentFilter?: string;
  campaignId?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function weekLabel(date: Date): string {
  return date.toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

function getWeekBuckets(count: number): { start: Date; end: Date; label: string }[] {
  const buckets: { start: Date; end: Date; label: string }[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const end = new Date(now);
    end.setDate(now.getDate() - i * 7);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    buckets.push({ start, end, label: weekLabel(start) });
  }
  return buckets;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default async function RecognitionAnalyticsSection({
  since,
  departmentFilter,
  campaignId,
}: Props) {
  // Build base feedback query conditions
  const sinceIso = since?.toISOString();

  // ── 1. Top givers ─────────────────────────────────────────────────────────
  let giversQuery = supabaseAdmin
    .from("feedback")
    .select("from_user_id, from_user:from_user_id(name)")
    .eq("visibility", "public");

  if (sinceIso) giversQuery = giversQuery.gte("created_at", sinceIso);
  if (campaignId) giversQuery = giversQuery.eq("campaign_id", campaignId);

  const { data: rawGivers } = await giversQuery;

  type GiverRow = { from_user_id: string; from_user: { name: string } | null };
  const giverRows = (rawGivers ?? []) as unknown as GiverRow[];

  const giverCounts = new Map<string, { name: string; count: number }>();
  for (const row of giverRows) {
    const existing = giverCounts.get(row.from_user_id);
    if (existing) {
      existing.count++;
    } else {
      giverCounts.set(row.from_user_id, {
        name: row.from_user?.name ?? "Staff member",
        count: 1,
      });
    }
  }
  const topGivers = [...giverCounts.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const totalRecognitions = giverRows.length;

  // ── 2. Top receivers ──────────────────────────────────────────────────────
  // Join feedback_recipients → feedback to apply time/campaign filters.
  // Strategy: fetch feedback IDs matching filters first, then recipients.
  let feedbackIdQuery = supabaseAdmin
    .from("feedback")
    .select("id")
    .eq("visibility", "public");

  if (sinceIso) feedbackIdQuery = feedbackIdQuery.gte("created_at", sinceIso);
  if (campaignId) feedbackIdQuery = feedbackIdQuery.eq("campaign_id", campaignId);

  const { data: feedbackIds } = await feedbackIdQuery;
  const ids = (feedbackIds ?? []).map((f: { id: string }) => f.id);

  type RecipRow = { user_id: string; user: { name: string; department: string | null } | null };
  let recipientsData: RecipRow[] = [];

  if (ids.length > 0) {
    const recipQuery = supabaseAdmin
      .from("feedback_recipients")
      .select("user_id, user:user_id(name, department)")
      .in("feedback_id", ids);

    if (departmentFilter) {
      // Filter by department via the joined user row — handled in-app below
      // (Supabase doesn't support filtering on foreign key columns in .in() chains directly)
    }

    const { data: rawRecipients } = await recipQuery;
    recipientsData = (rawRecipients ?? []) as unknown as RecipRow[];

    if (departmentFilter) {
      recipientsData = recipientsData.filter(
        (r) => r.user?.department === departmentFilter,
      );
    }
  }

  const receiverCounts = new Map<string, { name: string; count: number }>();
  for (const row of recipientsData) {
    const existing = receiverCounts.get(row.user_id);
    if (existing) {
      existing.count++;
    } else {
      receiverCounts.set(row.user_id, {
        name: row.user?.name ?? "Staff member",
        count: 1,
      });
    }
  }
  const topReceivers = [...receiverCounts.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // ── 3. Value distribution ─────────────────────────────────────────────────
  const { data: allValues } = await supabaseAdmin
    .from("recognition_values")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  // Count value_id usage from giverRows (already fetched, but without value_id)
  // We need value_id — re-query with it included.
  let valueQuery = supabaseAdmin
    .from("feedback")
    .select("value_id")
    .eq("visibility", "public")
    .not("value_id", "is", null);

  if (sinceIso) valueQuery = valueQuery.gte("created_at", sinceIso);
  if (campaignId) valueQuery = valueQuery.eq("campaign_id", campaignId);

  const { data: valueRows } = await valueQuery;
  const valueCounts = new Map<string, number>();
  for (const row of (valueRows ?? []) as { value_id: string | null }[]) {
    if (row.value_id) {
      valueCounts.set(row.value_id, (valueCounts.get(row.value_id) ?? 0) + 1);
    }
  }

  const valueDistribution = (allValues ?? []).map((v: { id: string; name: string }) => ({
    label: v.name,
    count: valueCounts.get(v.id) ?? 0,
  }));

  // ── 4. Weekly trend (last 8 weeks) ────────────────────────────────────────
  const buckets = getWeekBuckets(8);

  let trendQuery = supabaseAdmin
    .from("feedback")
    .select("created_at")
    .eq("visibility", "public");

  // Use the earliest bucket start to fetch all needed data at once
  const trendSince = buckets[0]?.start;
  if (trendSince) trendQuery = trendQuery.gte("created_at", trendSince.toISOString());
  if (campaignId) trendQuery = trendQuery.eq("campaign_id", campaignId);

  const { data: trendRows } = await trendQuery;
  const trendDates = (trendRows ?? []).map(
    (r: { created_at: string }) => new Date(r.created_at),
  );

  const weeklyTrend = buckets.map(({ start, end, label }) => ({
    label,
    count: trendDates.filter((d) => d >= start && d <= end).length,
  }));

  // ── 5. Cross-team reach (distinct departments) ────────────────────────────
  const uniqueDepts = new Set(
    recipientsData
      .map((r) => r.user?.department)
      .filter((d): d is string => typeof d === "string" && d.length > 0),
  );
  const crossTeamReach = uniqueDepts.size;

  const uniqueRecipients = recipientsData.length > 0
    ? new Set(recipientsData.map((r) => r.user_id)).size
    : 0;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="Recognitions sent"
          value={totalRecognitions}
          icon="solar:heart-broken"
          color="orange"
          compact
          subtitle={since ? `Since ${since.toLocaleDateString("en-KE", { day: "numeric", month: "short" })}` : "All time"}
        />
        <StatCard
          title="People recognised"
          value={uniqueRecipients}
          icon="solar:users-group-broken"
          color="violet"
          compact
          subtitle="Unique recipients"
        />
        <StatCard
          title="Cross-team reach"
          value={crossTeamReach}
          icon="solar:buildings-broken"
          color="blue"
          compact
          subtitle="Distinct departments"
        />
        <StatCard
          title="Active values"
          value={valueDistribution.filter((v) => v.count > 0).length}
          icon="solar:medal-ribbon-broken"
          color="amber"
          compact
          subtitle={`of ${valueDistribution.length} total`}
        />
      </section>

      {/* Charts row */}
      <section className="grid gap-5 xl:grid-cols-2">
        {/* Weekly trend */}
        <SectionCard
          icon="solar:graph-up-broken"
          title="Recognition trend"
          description="Recognitions sent per week over the last 8 weeks"
        >
          <RecognitionTrendChart data={weeklyTrend} />
        </SectionCard>

        {/* Value distribution */}
        <SectionCard
          icon="solar:pie-chart-2-broken"
          title="Value distribution"
          description="How often each recognition value is used"
        >
          {valueDistribution.some((v) => v.count > 0) ? (
            <SurveyDistributionChart data={valueDistribution} />
          ) : (
            <EmptyState text="No value data for this period." />
          )}
        </SectionCard>
      </section>

      {/* Leaderboards */}
      <section className="grid gap-5 lg:grid-cols-2">
        <LeaderBoard
          title="Top givers"
          icon="solar:hand-heart-broken"
          items={topGivers}
          label="sent"
        />
        <LeaderBoard
          title="Top receivers"
          icon="solar:star-broken"
          items={topReceivers}
          label="received"
        />
      </section>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/30 dark:shadow-black/20">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
          <Icon icon={icon} className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-hi)]">{title}</h2>
          {description && <p className="text-[11px] text-[var(--text-lo)]">{description}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function LeaderBoard({
  title,
  icon,
  items,
  label,
}: {
  title: string;
  icon: string;
  items: { id: string; name: string; count: number }[];
  label: string;
}) {
  return (
    <SectionCard icon={icon} title={title}>
      {items.length > 0 ? (
        <ol className="divide-y divide-[var(--border)]">
          {items.map((item, i) => (
            <li key={item.id} className="flex items-center gap-3 py-2.5">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  i === 0
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                    : "bg-[var(--surface-2)] text-[var(--text-lo)]"
                }`}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text-hi)]">
                {item.name}
              </span>
              <span className="font-mono text-xs font-semibold text-brand-500">
                {item.count} {label}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState text="No data for this period." />
      )}
    </SectionCard>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-[var(--border)] px-6 text-center text-sm text-[var(--text-lo)]">
      {text}
    </div>
  );
}
