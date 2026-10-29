import { getServerSession } from "next-auth";
import { Avatar } from "@/components/ui/Avatar";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { Icon } from "@iconify/react";
import dynamic from "next/dynamic";

// Recharts is heavy, so the charts load after the rest of the dashboard, with a placeholder of the same height.
const DashboardCharts = dynamic(() => import("./DashboardCharts"), {
  loading: () => (
    <div className="h-72 animate-pulse rounded-2xl bg-[var(--surface-2)]" />
  ),
});
import DashboardHeader from "./DashboardHeader";
import { resolveRange } from "./DashboardRange";
import { getDashboardData } from "../data";
import PipelineOverview from "./PipelineOverview";
import OfferTrackerChart from "./OfferTrackerChart";
import GoalsWidget from "./GoalsWidget";

// ─── Sub-components ───────────────────────────────────────────────────────────

type StatDef = {
  label: string;
  value: number;
  icon: string;
  accent: string;
  accentBg: string;
  href: string;
  note?: string;
};

function KpiCard({ stat }: { stat: StatDef }) {
  return (
    <Link
      href={stat.href}
      className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/50 hover:shadow-2xl dark:shadow-black/20 p-5 transition-all duration-300 hover:border-brand-500/30 hover:-translate-y-0.5 block"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold capitalize text-[var(--text-lo)]">
            {stat.label}
          </p>
          <p
            className={`mt-2 font-mono text-3xl font-bold leading-none ${stat.accent}`}
          >
            {stat.value.toLocaleString()}
          </p>
          {stat.note && (
            <p className="mt-1.5 text-[11px] text-amber-500">{stat.note}</p>
          )}
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${stat.accentBg} shadow-sm transition-transform duration-300 group-hover:scale-110`}
        >
          <Icon icon={stat.icon} className={`h-5 w-5 ${stat.accent}`} />
        </div>
      </div>
      {/* Bottom accent line on hover */}
      <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-gradient-to-r from-brand-500 to-brand-500/0 transition-all duration-500 group-hover:w-full" />
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ from?: string; to?: string; preset?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const range = resolveRange(params);

  const session = await getServerSession(authOptions);
  const ctx = session?.user
    ? {
        userId: session.user.id,
        role: session.user.role,
        department: session.user.department ?? null,
        viewAllScreens:
          session.user.extraPermissions?.includes("view_admin_screens") ??
          false,
      }
    : undefined;

  const data = await getDashboardData(range, ctx);
  const { stats, pipeline, trend, rolePipeline, stageAging, teamPulseTrend } =
    data;
  const operations = data.operations ?? {
    interviewQueue: [],
    upcomingOneOnOnes: [],
    actionItems: [],
    health: {
      averageDaysToHire: null,
      stalledCandidates: 0,
      offerPending: 0,
      offerAccepted: 0,
      offerDeclined: 0,
    },
    pulse: { pendingCheckins: 0, lowMood: 0, blockers: 0, atRiskGoals: 0 },
    scheduledJobs: [],
    goals: { onTrack: 0, atRisk: 0, completed: 0, notStarted: 0 },
    newHires: [],
    activeSurveys: [],
  };

  const firstName = session?.user.name?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? { text: "Good morning", icon: "solar:sun-fog-broken" }
      : hour < 17
        ? { text: "Good afternoon", icon: "solar:sun-broken" }
        : hour < 21
          ? { text: "Good evening", icon: "solar:moon-stars-broken" }
          : { text: "Working late", icon: "solar:moon-sleep-broken" };

  // ── Hero banner (shared across all views) ─────────────────────────────────
  const heroBanner = (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a0a04] via-[#2d1107] to-[#0f0f14] p-7 shadow-2xl">
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-500 opacity-[0.07] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 left-1/3 h-48 w-48 rounded-full bg-violet-500 opacity-[0.06] blur-3xl" />
      <div className="pointer-events-none absolute right-1/4 top-1/2 h-32 w-32 rounded-full bg-amber-400 opacity-[0.05] blur-2xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-500/20 backdrop-blur-sm">
              <Icon icon={greeting.icon} className="h-5 w-5 text-amber-300" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {greeting.text}, {firstName}
            </h1>
          </div>
          <p className="mt-2 text-sm text-white/50 capitalize">
            {session?.user.role?.replace("_", " ")} ·{" "}
            {session?.user.department ?? "Growthpad"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-white/50">
            {new Date().toLocaleDateString("en-GB", { weekday: "long" })}
          </p>
          <p className="text-xs text-white/30">
            {new Date().toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </div>
    </div>
  );

  // ── Personal view ─────────────────────────────────────────────────────────
  if (data.view === "personal" && data.personal) {
    const p = data.personal;
    const personalKpis: StatDef[] = [
      {
        label: "My points",
        value: p.points,
        icon: "solar:cup-star-broken",
        accent: "text-amber-500",
        accentBg: "bg-amber-500/10",
        href: "/pulse/rewards",
      },
      {
        label: "Recognitions given",
        value: p.recognitionsGiven,
        icon: "solar:star-broken",
        accent: "text-amber-500",
        accentBg: "bg-amber-500/10",
        href: "/pulse/feedback",
      },
      {
        label: "Recognitions received",
        value: p.recognitionsReceived,
        icon: "solar:confetti-minimalistic-broken",
        accent: "text-brand-500",
        accentBg: "bg-brand-500/10",
        href: "/pulse/feedback",
      },
      {
        label: "Goals on track",
        value: p.goals.onTrack,
        icon: "solar:target-broken",
        accent: "text-green-500",
        accentBg: "bg-green-500/10",
        href: "/pulse/goals",
      },
      {
        label: "Upcoming 1-on-1s",
        value: p.upcomingOneOnOnes.length,
        icon: "solar:chat-round-dots-broken",
        accent: "text-violet-500",
        accentBg: "bg-violet-500/10",
        href: "/pulse/one-on-ones?view=upcoming",
      },
    ];

    return (
      <div className="-mt-6 space-y-6 md:-mt-8">
        <DashboardHeader range={range} description="Your personal workspace" />

        {heroBanner}

        {/* ── Personal KPI row ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {personalKpis.map((stat) => (
            <KpiCard key={stat.label} stat={stat} />
          ))}
        </div>

        {/* ── Action items + Goals + 1-on-1s ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* My action items */}
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/15">
                <Icon
                  icon="solar:checklist-broken"
                  className="h-3.5 w-3.5 text-brand-500"
                />
              </div>
              <div>
                <h2 className="text-md font-semibold text-[var(--text-hi)]">
                  My action items
                </h2>
                <p className="text-[11px] text-[var(--text-lo)]">
                  Items that need attention
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {operations.actionItems.length ? (
                operations.actionItems.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] px-3 py-2.5 transition-colors hover:bg-brand-500/10"
                  >
                    <span className="text-sm text-[var(--text-hi)]">
                      {item.label}
                    </span>
                    <span
                      className={`rounded-lg px-2 py-0.5 font-mono text-xs font-bold ${item.tone === "red" ? "bg-red-500/10 text-red-500" : item.tone === "amber" ? "bg-amber-500/10 text-amber-500" : "bg-blue-500/10 text-blue-500"}`}
                    >
                      {item.count}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="rounded-xl bg-green-500/5 px-3 py-4 text-sm text-green-600">
                  You&apos;re all caught up.
                </p>
              )}
            </div>
          </section>

          {/* Goals widget */}
          <GoalsWidget
            onTrack={p.goals.onTrack}
            atRisk={p.goals.atRisk}
            completed={p.goals.completed}
            notStarted={p.goals.notStarted}
          />

          {/* Upcoming 1-on-1s */}
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
                  <Icon
                    icon="solar:chat-round-dots-broken"
                    className="h-3.5 w-3.5 text-brand-500"
                  />
                </div>
                <div>
                  <h2 className="text-md font-semibold text-[var(--text-hi)]">
                    Upcoming 1-on-1s
                  </h2>
                  <p className="text-[11px] text-[var(--text-lo)]">
                    Your next scheduled meetings
                  </p>
                </div>
              </div>
              <Link
                href="/pulse/one-on-ones?view=upcoming"
                className="text-xs text-brand-500 hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="space-y-2">
              {p.upcomingOneOnOnes.length ? (
                p.upcomingOneOnOnes.map((m) => (
                  <Link
                    key={m.id}
                    href={`/pulse/one-on-ones/${m.id}`}
                    className="flex items-start gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-[var(--surface-2)]"
                  >
                    <Avatar
                      name={m.with}
                      src={m.withAvatar}
                      size="sm"
                      shape="circle"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[var(--text-hi)]">
                        with {m.with}
                      </p>
                      <p className="text-[11px] text-[var(--text-lo)]">
                        {new Date(m.scheduled_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="rounded-xl bg-[var(--surface-2)] px-3 py-4 text-sm text-[var(--text-lo)]">
                  No 1-on-1s scheduled.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    );
  }

  // ── Org / Team view ───────────────────────────────────────────────────────
  const kpis: StatDef[] = [
    {
      label: "Open Roles",
      value: stats.openJobs,
      icon: "solar:case-broken",
      accent: "text-brand-500",
      accentBg: "bg-brand-500/10",
      href: "/hire/jobs?status=open",
    },
    {
      label: "Active Pipeline",
      value: stats.activePipeline,
      icon: "solar:users-group-two-rounded-broken",
      accent: "text-blue-500",
      accentBg: "bg-blue-500/10",
      href: "/hire/candidates?stage=active",
    },
    {
      label: "Employees",
      value: stats.activeEmployees,
      icon: "solar:people-nearby-broken",
      accent: "text-green-500",
      accentBg: "bg-green-500/10",
      href: "/staff",
    },
    {
      label: "Hired",
      value: stats.hired,
      icon: "solar:check-circle-broken",
      accent: "text-emerald-500",
      accentBg: "bg-emerald-500/10",
      href: "/hire/candidates?stage=hired",
    },
  ];

  return (
    <div className="-mt-6 space-y-6 md:-mt-8">
      <DashboardHeader range={range} description="Hiring and people overview" />

      {heroBanner}

      {/* ── KPI row ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((stat) => (
          <KpiCard key={stat.label} stat={stat} />
        ))}
      </div>

      {/* ── Operating queue ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/15">
              <Icon
                icon="solar:checklist-broken"
                className="h-3.5 w-3.5 text-brand-500"
              />
            </div>
            <div>
              <h2 className="text-md font-semibold text-[var(--text-hi)]">
                My action items
              </h2>
              <p className="text-[11px] text-[var(--text-lo)]">
                Items that need attention
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {operations.actionItems.length ? (
              operations.actionItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] px-3 py-2.5 transition-colors hover:bg-brand-500/10"
                >
                  <span className="text-sm text-[var(--text-hi)]">
                    {item.label}
                  </span>
                  <span
                    className={`rounded-lg px-2 py-0.5 font-mono text-xs font-bold ${item.tone === "red" ? "bg-red-500/10 text-red-500" : item.tone === "amber" ? "bg-amber-500/10 text-amber-500" : "bg-blue-500/10 text-blue-500"}`}
                  >
                    {item.count}
                  </span>
                </Link>
              ))
            ) : (
              <p className="rounded-xl bg-green-500/5 px-3 py-4 text-sm text-green-600">
                You&apos;re all caught up.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
                <Icon
                  icon="solar:calendar-broken"
                  className="h-3.5 w-3.5 text-brand-500"
                />
              </div>
              <div>
                <h2 className="text-md font-semibold text-[var(--text-hi)]">
                  Interview queue
                </h2>
                <p className="text-[11px] text-[var(--text-lo)]">
                  Scorecards still to complete
                </p>
              </div>
            </div>
            <Link
              href="/hire/candidates?stage=interview"
              className="text-xs text-brand-500 hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {operations.interviewQueue.length ? (
              operations.interviewQueue.map((candidate) => (
                <Link
                  key={candidate.id}
                  href={`/hire/candidates/${candidate.id}/interview`}
                  className="flex items-center justify-between rounded-xl px-2 py-2 transition-colors hover:bg-[var(--surface-2)]"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--text-hi)]">
                      {candidate.full_name}
                    </p>
                    <p className="text-[11px] text-[var(--text-lo)]">
                      {candidate.jobs?.title ?? "Role"}
                    </p>
                  </div>
                  <Icon
                    icon="solar:arrow-right-broken"
                    className="h-4 w-4 text-[var(--text-lo)]"
                  />
                </Link>
              ))
            ) : (
              <p className="rounded-xl bg-[var(--surface-2)] px-3 py-4 text-sm text-[var(--text-lo)]">
                No interviews waiting for a scorecard.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
              <Icon
                icon="solar:users-group-two-rounded-broken"
                className="h-3.5 w-3.5 text-brand-500"
              />
            </div>
            <div>
              <h2 className="text-md font-semibold text-[var(--text-hi)]">
                Check-in status
              </h2>
              <p className="text-[11px] text-[var(--text-lo)]">
                This week&apos;s check-ins and goals
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                label: "Check-ins due",
                value: operations.pulse.pendingCheckins,
                href: "/pulse/checkins",
              },
              {
                label: "Low mood",
                value: operations.pulse.lowMood,
                href: "/pulse/checkins",
              },
              {
                label: "Blockers",
                value: operations.pulse.blockers,
                href: "/pulse/checkins",
              },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-xl bg-[var(--surface-2)] p-3 transition-colors hover:bg-cyan-500/10"
              >
                <p className="font-mono text-xl font-bold text-[var(--text-hi)]">
                  {item.value}
                </p>
                <p className="mt-1 text-[11px] text-[var(--text-lo)]">
                  {item.label}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* ── Second ops row: 1-on-1s, Goals, New hires, Surveys ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Upcoming 1-on-1s */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
                <Icon
                  icon="solar:chat-round-dots-broken"
                  className="h-3.5 w-3.5 text-brand-500"
                />
              </div>
              <div>
                <h2 className="text-md font-semibold text-[var(--text-hi)]">
                  Upcoming 1-on-1s
                </h2>
                <p className="text-[11px] text-[var(--text-lo)]">
                  Next scheduled meetings
                </p>
              </div>
            </div>
            <Link
              href="/pulse/one-on-ones?view=upcoming"
              className="text-xs text-brand-500 hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {operations.upcomingOneOnOnes.length ? (
              operations.upcomingOneOnOnes.map((m) => (
                <Link
                  key={m.id}
                  href={`/pulse/one-on-ones/${m.id}`}
                  className="flex items-start gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-[var(--surface-2)]"
                >
                  <Avatar
                    name={m.report}
                    src={m.reportAvatar}
                    size="sm"
                    shape="circle"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[var(--text-hi)]">
                      {m.report}
                    </p>
                    <p className="text-[11px] text-[var(--text-lo)]">
                      with {m.manager} ·{" "}
                      {new Date(m.scheduled_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              <p className="rounded-xl bg-[var(--surface-2)] px-3 py-4 text-sm text-[var(--text-lo)]">
                No 1-on-1s scheduled.
              </p>
            )}
          </div>
        </section>

        {/* Goals summary */}
        <GoalsWidget
          onTrack={operations.goals.onTrack}
          atRisk={operations.goals.atRisk}
          completed={operations.goals.completed}
          notStarted={operations.goals.notStarted}
        />

        {/* New hires onboarding */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
                <Icon
                  icon="solar:confetti-minimalistic-broken"
                  className="h-3.5 w-3.5 text-brand-500"
                />
              </div>
              <div>
                <h2 className="text-md font-semibold text-[var(--text-hi)]">
                  New hires
                </h2>
                <p className="text-[11px] text-[var(--text-lo)]">
                  Joined in the last 30 days
                </p>
              </div>
            </div>
            <Link
              href="/staff"
              className="text-xs text-brand-500 hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {operations.newHires.length ? (
              operations.newHires.map((hire) => (
                <Link
                  key={hire.id}
                  href={`/staff/${hire.id}`}
                  className="flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-[var(--surface-2)]"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400/20 to-brand-500/20 text-[10px] font-bold text-amber-500">
                    {hire.name
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-[var(--text-hi)]">
                      {hire.name}
                    </p>
                    <p className="truncate text-[11px] text-[var(--text-lo)]">
                      {hire.job_title ?? hire.department ?? "New employee"}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-[var(--text-lo)]">
                    {new Date(hire.start_date).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </Link>
              ))
            ) : (
              <p className="rounded-xl bg-[var(--surface-2)] px-3 py-4 text-sm text-[var(--text-lo)]">
                No new hires this month.
              </p>
            )}
          </div>
        </section>

        {/* Active surveys */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
                <Icon
                  icon="solar:chart-2-broken"
                  className="h-3.5 w-3.5 text-brand-500"
                />
              </div>
              <div>
                <h2 className="text-md font-semibold text-[var(--text-hi)]">
                  Active surveys
                </h2>
                <p className="text-[11px] text-[var(--text-lo)]">
                  Live and collecting responses
                </p>
              </div>
            </div>
            <Link
              href="/pulse/surveys"
              className="text-xs text-brand-500 hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {operations.activeSurveys.length ? (
              operations.activeSurveys.map((survey) => (
                <Link
                  key={survey.id}
                  href={`/pulse/surveys/${survey.id}`}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--surface-2)]"
                >
                  <p className="truncate text-xs font-medium text-[var(--text-hi)]">
                    {survey.title}
                  </p>
                  <span className="ml-2 shrink-0 rounded-lg bg-pink-500/10 px-2 py-0.5 font-mono text-xs font-bold text-pink-500">
                    {survey.response_count}
                  </span>
                </Link>
              ))
            ) : (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <Icon
                  icon="solar:chart-2-broken"
                  className="h-8 w-8 text-[var(--text-lo)] opacity-40"
                />
                <p className="text-xs text-[var(--text-lo)]">
                  No active surveys.
                </p>
                <Link
                  href="/pulse/surveys"
                  className="text-xs font-semibold text-brand-500 hover:underline"
                >
                  Create one
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── Charts row ── */}
      <DashboardCharts
        trend={trend}
        rolePipeline={rolePipeline}
        teamPulseTrend={teamPulseTrend}
      />

      {/* ── Hiring health, offers and schedules ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="flex h-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
                <Icon
                  icon="solar:sort-horizontal-broken"
                  className="h-3.5 w-3.5"
                />
              </div>
              <div>
                <h2 className="text-md font-semibold text-[var(--text-hi)]">
                  Pipeline
                </h2>
                <p className="mt-0.5 text-[11px] text-[var(--text-lo)]">
                  Where candidates are now, and how long they have been there
                </p>
              </div>
            </div>
          </div>
          <PipelineOverview
            pipeline={pipeline}
            stages={stageAging}
            stalled={operations.health.stalledCandidates}
            averageDays={operations.health.averageDaysToHire}
          />
        </section>
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
                <Icon
                  icon="solar:wallet-money-broken"
                  className="h-3.5 w-3.5"
                />
              </div>
              <div>
                <h2 className="text-md font-semibold text-[var(--text-hi)]">
                  Pipeline outcomes
                </h2>
                <p className="mt-0.5 text-[11px] text-[var(--text-lo)]">
                  Pending offers and completed candidate outcomes
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <OfferTrackerChart
              pending={operations.health.offerPending}
              accepted={operations.health.offerAccepted}
              declined={operations.health.offerDeclined}
            />
          </div>
        </section>
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
                <Icon icon="solar:calendar-broken" className="h-3.5 w-3.5" />
              </div>
              <div>
                <h2 className="text-md font-semibold text-[var(--text-hi)]">
                  Role schedule
                </h2>
                <p className="mt-0.5 text-[11px] text-[var(--text-lo)]">
                  Publishing and closing soon
                </p>
              </div>
            </div>
            <Link
              href="/hire/jobs"
              className="text-xs text-brand-500 hover:underline"
            >
              Jobs
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {operations.scheduledJobs.length ? (
              operations.scheduledJobs.map((job) => {
                const date =
                  job.kind === "publishes" ? job.published_at : job.closes_at;
                return (
                  <Link
                    key={`${job.id}-${job.kind}`}
                    href={`/hire/jobs/${job.id}`}
                    className="flex items-center justify-between rounded-xl px-2 py-2 hover:bg-[var(--surface-2)]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--text-hi)]">
                        {job.title}
                      </p>
                      <p className="text-[11px] text-[var(--text-lo)]">
                        {job.kind === "publishes" ? "Publishes" : "Closes"}{" "}
                        {date
                          ? new Date(date).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                            })
                          : ""}
                      </p>
                    </div>
                    <Icon
                      icon="solar:calendar-mark-broken"
                      className="h-4 w-4 shrink-0 text-brand-500"
                    />
                  </Link>
                );
              })
            ) : (
              <p className="rounded-xl bg-[var(--surface-2)] px-3 py-4 text-sm text-[var(--text-lo)]">
                No scheduled role changes.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
