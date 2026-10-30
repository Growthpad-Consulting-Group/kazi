import { Icon } from "@iconify/react";
import StatCard from "@/components/ui/StatCard";

export type VoiceOutInsight = {
  topic: string;
  status: string;
  priority: string;
  sentiment: "negative" | "neutral" | "positive";
  created_at: string;
};
const TOPICS: Record<string, string> = {
  workplace: "Workplace",
  wellbeing: "Wellbeing",
  inclusion: "Inclusion",
  leadership: "Leadership",
  other: "Other",
};
const MINIMUM_GROUP_SIZE = 5;

export function VoiceOutInsights({ reports }: { reports: VoiceOutInsight[] }) {
  const hasSafeAggregate = reports.length >= MINIMUM_GROUP_SIZE;
  const open = reports.filter(
    (report) => report.status === "new" || report.status === "in_review",
  ).length;
  const priority = reports.filter(
    (report) => report.priority === "high" || report.priority === "urgent",
  ).length;
  const byTopic = Object.entries(
    reports.reduce<Record<string, number>>(
      (acc, report) => ({
        ...acc,
        [report.topic]: (acc[report.topic] ?? 0) + 1,
      }),
      {},
    ),
  ).sort(([, a], [, b]) => b - a);
  const visibleTopics = byTopic.filter(
    ([, count]) => count >= MINIMUM_GROUP_SIZE,
  );
  const protectedCount =
    reports.length -
    visibleTopics.reduce((total, [, count]) => total + count, 0);
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const recent = reports.filter(
    (report) => new Date(report.created_at) >= since,
  ).length;
  const sentiment = reports.reduce<Record<string, number>>(
    (acc, report) => ({
      ...acc,
      [report.sentiment]: (acc[report.sentiment] ?? 0) + 1,
    }),
    {},
  );
  const visibleSentiment = Object.entries(sentiment).filter(
    ([, count]) => count >= MINIMUM_GROUP_SIZE,
  );

  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
          <Icon icon="solar:chart-square-broken" className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-hi)]">
            Protected Voice Out insights
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-lo)]">
            Themes are only shown when at least {MINIMUM_GROUP_SIZE} reports
            support a group. Individual messages remain available only to HR.
          </p>
        </div>
      </div>
      {hasSafeAggregate ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              title="Reports"
              value={reports.length}
              icon="solar:chat-round-dots-broken"
              color="blue"
              compact
              subtitle="All time"
            />
            <StatCard
              title="Last 30 days"
              value={recent}
              icon="solar:calendar-broken"
              color="orange"
              compact
              subtitle="Recent volume"
            />
            <StatCard
              title="Open cases"
              value={open}
              icon="solar:clock-circle-broken"
              color={open ? "amber" : "slate"}
              compact
              subtitle="Needs HR action"
            />
            <StatCard
              title="Priority cases"
              value={priority}
              icon="solar:danger-triangle-broken"
              color={priority ? "red" : "slate"}
              compact
              subtitle="High or urgent"
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <InsightList
              title="Recurring themes"
              description="Topic detail is suppressed below the privacy threshold."
              items={visibleTopics.map(([topic, count]) => ({
                label: TOPICS[topic] ?? topic,
                count,
                tone: "bg-gradient-to-r from-blue-500 to-sky-400",
              }))}
              total={reports.length}
              fallback={
                protectedCount
                  ? `${protectedCount} report${protectedCount === 1 ? " is" : "s are"} in protected, low-volume themes.`
                  : "No theme has reached the privacy threshold yet."
              }
            />
            <InsightList
              title="Sentiment signal"
              description="A reporter-selected signal, never inferred from their words."
              items={visibleSentiment.map(([value, count]) => ({
                label:
                  value === "negative"
                    ? "Concerning"
                    : value === "positive"
                      ? "Positive"
                      : "Neutral",
                count,
                tone:
                  value === "negative"
                    ? "bg-gradient-to-r from-red-500 to-rose-400"
                    : value === "positive"
                      ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                      : "bg-gradient-to-r from-slate-500 to-slate-400",
              }))}
              total={reports.length}
              fallback="Sentiment groups remain protected until each reaches the privacy threshold."
            />
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-5 py-8 text-center">
          <Icon
            icon="solar:eye-closed-broken"
            className="mx-auto h-6 w-6 text-[var(--text-lo)]"
          />
          <h3 className="mt-3 text-base font-semibold text-[var(--text-hi)]">
            Insights are protected
          </h3>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-[var(--text-lo)]">
            Kazi will show aggregated trends after at least {MINIMUM_GROUP_SIZE}{" "}
            anonymous reports. There are currently {reports.length}.
          </p>
        </div>
      )}
    </section>
  );
}

function InsightList({
  title,
  description,
  items,
  total,
  fallback,
}: {
  title: string;
  description: string;
  items: { label: string; count: number; tone: string }[];
  total: number;
  fallback: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20">
      <h3 className="text-sm font-semibold text-[var(--text-hi)]">{title}</h3>
      <p className="mt-1 text-xs text-[var(--text-lo)]">{description}</p>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[var(--text-hi)]">
                {item.label}
              </span>
              <span className="font-mono font-semibold text-[var(--text-lo)]">
                {item.count}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
              <div
                className={`h-full rounded-full ${item.tone}`}
                style={{ width: `${Math.round((item.count / total) * 100)}%` }}
              />
            </div>
          </div>
        ))}
        {!items.length && (
          <p className="rounded-xl bg-[var(--surface-2)] px-3 py-3 text-xs text-[var(--text-lo)]">
            {fallback}
          </p>
        )}
      </div>
    </div>
  );
}
