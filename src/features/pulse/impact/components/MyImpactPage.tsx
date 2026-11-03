import Link from "next/link";
import { Icon } from "@iconify/react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import SetPageHeader from "@/components/ui/SetPageHeader";
import StatCard from "@/components/ui/StatCard";
import { todayInWorkTimezone } from "@/features/pulse/dashboard/my-week";
import { loadMyImpact, type ImpactData } from "../data";

const MILESTONE_LABELS: Record<string, string> = {
  work_anniversary: "Work anniversary",
  birthday: "Birthday",
  onboarding_complete: "Onboarding complete",
};

function formatMonth(month: string) {
  return new Date(`${month}-01T12:00:00Z`).toLocaleDateString("en-GB", {
    month: "short",
    timeZone: "UTC",
  });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDuration(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours && minutes
    ? `${hours}h ${minutes}m`
    : hours
      ? `${hours}h`
      : `${minutes}m`;
}

export default async function MyImpactPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const data = await loadMyImpact(
    session.user.id,
    todayInWorkTimezone(new Date()),
  );
  const goalsCompleted = data.goals.filter((g) => g.status === "completed");
  const openGoals = data.goals.filter(
    (g) => !["completed", "cancelled"].includes(g.status),
  );

  return (
    <>
      <SetPageHeader
        title="My impact"
        description="Your own progress, recognition and milestones. Only you can see this page."
        icon="solar:graph-up-broken"
        actions={[
          {
            label: "My goals",
            icon: "solar:target-broken",
            href: "/pulse/goals",
            variant: "secondary" as const,
          },
        ]}
      />

      <div className="mx-auto max-w-7xl space-y-5">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            title="Goals completed"
            value={goalsCompleted.length}
            icon="solar:target-broken"
            color="green"
            compact
            subtitle={`${openGoals.length} still active`}
            href="/pulse/goals"
          />
          <StatCard
            title="Recognition"
            value={data.recognitionTotal}
            icon="solar:star-fall-broken"
            color="amber"
            compact
            subtitle="Last 6 months"
            href="/pulse/feedback"
          />
          <StatCard
            title="Side Quests"
            value={data.quests.length}
            icon="solar:flag-broken"
            color="blue"
            compact
            subtitle="Approved completions"
            href="/pulse/side-quests"
          />
          <StatCard
            title="Achievements"
            value={data.achievements.length}
            icon="solar:medal-ribbon-broken"
            color="orange"
            compact
            subtitle="Earned so far"
          />
        </section>

        <div className="grid gap-5 xl:grid-cols-2">
          <WeeklyRhythm data={data} />
          <RecognitionTrend data={data} />
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <Panel icon="solar:target-broken" title="Goals completed">
            {goalsCompleted.length ? (
              <ul className="divide-y divide-[var(--border)]">
                {goalsCompleted.map((goal) => (
                  <li
                    key={goal.title}
                    className="flex items-center gap-3 py-2.5 text-sm text-[var(--text-hi)]"
                  >
                    <Icon
                      icon="solar:check-circle-broken"
                      className="h-4 w-4 shrink-0 text-emerald-600"
                    />
                    <span className="min-w-0 truncate">{goal.title}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty text="Goals you complete will be listed here." />
            )}
          </Panel>

          <Panel icon="solar:flag-broken" title="Side Quest completions">
            {data.quests.length ? (
              <ul className="divide-y divide-[var(--border)]">
                {data.quests.map((quest, index) => (
                  <li
                    key={`${quest.title}-${index}`}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <span className="min-w-0 truncate text-sm text-[var(--text-hi)]">
                      {quest.title}
                    </span>
                    <span className="shrink-0 text-xs text-[var(--text-lo)]">
                      {formatDate(quest.completedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty text="Approved Side Quests will appear here." />
            )}
          </Panel>

          <Panel icon="solar:medal-ribbon-broken" title="Achievements">
            {data.achievements.length ? (
              <ul className="space-y-3">
                {data.achievements.map((achievement) => (
                  <li
                    key={achievement.id}
                    className="flex gap-3 rounded-xl bg-[var(--surface-2)] p-3"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                      <Icon icon={achievement.icon} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--text-hi)]">
                        {achievement.title}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-lo)]">
                        {achievement.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty text="Achievements you earn will be listed here." />
            )}
          </Panel>

          <Panel icon="solar:calendar-mark-broken" title="Milestones">
            {data.milestones.length ? (
              <ul className="divide-y divide-[var(--border)]">
                {data.milestones.map((milestone, index) => (
                  <li
                    key={`${milestone.type}-${index}`}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <span className="text-sm text-[var(--text-hi)]">
                      {MILESTONE_LABELS[milestone.type] ??
                        milestone.type.replace(/_/g, " ")}
                      {milestone.yearsCount
                        ? ` · ${milestone.yearsCount} yr${milestone.yearsCount === 1 ? "" : "s"}`
                        : ""}
                    </span>
                    <span className="shrink-0 text-xs text-[var(--text-lo)]">
                      {formatDate(milestone.date)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty text="Work milestones will appear here." />
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

function WeeklyRhythm({ data }: { data: ImpactData }) {
  const max = Math.max(60, ...data.weeks.map((week) => week.minutes));
  return (
    <Panel icon="solar:clock-circle-broken" title="Weekly rhythm">
      <p className="mb-4 text-xs text-[var(--text-lo)]">
        Tracked time and logged workdays over the last eight weeks.
      </p>
      <div className="flex h-40 items-end gap-2">
        {data.weeks.map((week) => (
          <div
            key={week.weekStart}
            className="flex min-w-0 flex-1 flex-col items-center gap-2"
          >
            <span className="font-mono text-[10px] text-[var(--text-lo)]">
              {week.minutes ? formatDuration(week.minutes) : "—"}
            </span>
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full rounded-t-md bg-brand-500/80"
                style={{
                  height: `${Math.max(4, (week.minutes / max) * 100)}%`,
                }}
                title={`${week.workdaysLogged}/5 workdays logged`}
              />
            </div>
            <span className="text-[10px] text-[var(--text-lo)]">
              {week.workdaysLogged}/5
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function RecognitionTrend({ data }: { data: ImpactData }) {
  const max = Math.max(1, ...data.recognitionByMonth.map((m) => m.count));
  return (
    <Panel icon="solar:star-fall-broken" title="Recognition by month">
      <p className="mb-4 text-xs text-[var(--text-lo)]">
        Public recognition you received, counted by month. Senders are not shown
        here.
      </p>
      <div className="flex h-40 items-end gap-3">
        {data.recognitionByMonth.map((entry) => (
          <div
            key={entry.month}
            className="flex min-w-0 flex-1 flex-col items-center gap-2"
          >
            <span className="font-mono text-[10px] text-[var(--text-lo)]">
              {entry.count}
            </span>
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full rounded-t-md bg-emerald-500/70"
                style={{
                  height: `${Math.max(entry.count ? 8 : 4, (entry.count / max) * 100)}%`,
                }}
              />
            </div>
            <span className="text-[10px] text-[var(--text-lo)]">
              {formatMonth(entry.month)}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Panel({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
          <Icon icon={icon} className="h-3.5 w-3.5" />
        </span>
        <h2 className="text-sm font-semibold text-[var(--text-hi)]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex min-h-24 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-4 text-center">
      <p className="text-xs text-[var(--text-lo)]">{text}</p>
      <Link
        href="/pulse/checkins?tab=daily"
        className="mt-2 text-xs font-semibold text-brand-500 hover:text-brand-600"
      >
        Log today&apos;s activity
      </Link>
    </div>
  );
}
