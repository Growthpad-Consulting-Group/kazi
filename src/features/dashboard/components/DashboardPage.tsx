import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { Icon } from "@iconify/react";
import DashboardCharts from "./DashboardCharts";
import DashboardHeader from "./DashboardHeader";
import { resolveRange } from "./DashboardRange";
import { getDashboardData } from "../data";
import HiringHealthChart from "./HiringHealthChart";
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
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-lo)]">
            {stat.label}
          </p>
          <p className={`mt-2 font-mono text-3xl font-bold leading-none ${stat.accent}`}>
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

const STAGE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  applied:   { color: "#94a3b8", bg: "bg-slate-400",   label: "Applied" },
  screened:  { color: "#60a5fa", bg: "bg-blue-400",    label: "Screened" },
  interview: { color: "#a78bfa", bg: "bg-violet-400",  label: "Interview" },
  offer:     { color: "#fbbf24", bg: "bg-amber-400",   label: "Offer" },
  hired:     { color: "#4ade80", bg: "bg-green-400",   label: "Hired" },
  rejected:  { color: "#f87171", bg: "bg-red-400",     label: "Rejected" },
};

function PipelineFunnel({ stages }: { stages: { stage: string; count: number }[] }) {
  const active = stages.filter((s) => s.stage !== "rejected");
  const total = active.reduce((s, r) => s + r.count, 0) || 1;

  return (
    <div className="space-y-2">
      {active.map(({ stage, count }) => {
        const cfg = STAGE_CONFIG[stage] ?? { color: "#94a3b8", bg: "bg-slate-400", label: stage };
        const pct = Math.round((count / total) * 100);
        return (
          <Link
            key={stage}
            href={`/hire/candidates?stage=${stage}`}
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--surface-2)]"
          >
            <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${cfg.bg} shadow-sm`}
              style={{ boxShadow: `0 0 6px ${cfg.color}60` }} />
            <span className="w-20 shrink-0 text-xs text-[var(--text-hi)]">{cfg.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, backgroundColor: cfg.color }}
              />
            </div>
            <span className="w-8 shrink-0 text-right font-mono text-xs font-bold text-[var(--text-hi)]">{count}</span>
            <span className="w-8 shrink-0 text-right font-mono text-[10px] text-[var(--text-lo)]">{pct}%</span>
          </Link>
        );
      })}
    </div>
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
      }
    : undefined;

  const data = await getDashboardData(range, ctx);
  const { stats, pipeline, trend, rolePipeline, stageAging, teamPulseTrend } = data;
  const operations = data.operations ?? {
    interviewQueue: [],
    upcomingOneOnOnes: [],
    actionItems: [],
    health: { averageDaysToHire: null, stalledCandidates: 0, offerPending: 0, offerAccepted: 0, offerDeclined: 0 },
    pulse: { pendingCheckins: 0, lowMood: 0, blockers: 0, atRiskGoals: 0 },
    scheduledJobs: [],
    goals: { onTrack: 0, atRisk: 0, completed: 0, notStarted: 0 },
    newHires: [],
    activeSurveys: [],
  };

  const firstName = session?.user.name?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? { text: "Good morning", icon: "solar:sun-fog-broken" }
    : hour < 17 ? { text: "Good afternoon", icon: "solar:sun-broken" }
    : hour < 21 ? { text: "Good evening", icon: "solar:moon-stars-broken" }
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
            {session?.user.role?.replace("_", " ")} · {session?.user.department ?? "Growthpad"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-white/50">
            {new Date().toLocaleDateString("en-GB", { weekday: "long" })}
          </p>
          <p className="text-xs text-white/30">
            {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
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
        href: "/pulse/one-on-ones",
      },
    ];

    return (
      <div className="-mt-6 space-y-6 md:-mt-8">
        <DashboardHeader
          range={range}
          description="Your personal workspace"
        />

        {heroBanner}

        {/* ── Personal KPI row ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {personalKpis.map((stat) => <KpiCard key={stat.label} stat={stat} />)}
        </div>

        {/* ── Action items + Goals + 1-on-1s ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* My action items */}
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/15">
                <Icon icon="solar:checklist-broken" className="h-3.5 w-3.5 text-brand-500" />
              </div>
              <div>
                <h2 className="text-md font-semibold text-[var(--text-hi)]">My action items</h2>
                <p className="text-[11px] text-[var(--text-lo)]">Items that need attention</p>
              </div>
            </div>
            <div className="space-y-2">
              {operations.actionItems.length ? operations.actionItems.map((item) => (
                <Link key={item.label} href={item.href} className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] px-3 py-2.5 transition-colors hover:bg-brand-500/10">
                  <span className="text-sm text-[var(--text-hi)]">{item.label}</span>
                  <span className={`rounded-lg px-2 py-0.5 font-mono text-xs font-bold ${item.tone === "red" ? "bg-red-500/10 text-red-500" : item.tone === "amber" ? "bg-amber-500/10 text-amber-500" : "bg-blue-500/10 text-blue-500"}`}>{item.count}</span>
                </Link>
              )) : <p className="rounded-xl bg-green-500/5 px-3 py-4 text-sm text-green-600">You&apos;re all caught up.</p>}
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
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-500/15">
                  <Icon icon="solar:chat-round-dots-broken" className="h-3.5 w-3.5 text-violet-500" />
                </div>
                <div>
                  <h2 className="text-md font-semibold text-[var(--text-hi)]">Upcoming 1-on-1s</h2>
                  <p className="text-[11px] text-[var(--text-lo)]">Your next scheduled meetings</p>
                </div>
              </div>
              <Link href="/pulse/one-on-ones" className="text-xs text-brand-500 hover:underline">View all</Link>
            </div>
            <div className="space-y-2">
              {p.upcomingOneOnOnes.length ? p.upcomingOneOnOnes.map((m) => (
                <Link key={m.id} href="/pulse/one-on-ones" className="flex items-start gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-[var(--surface-2)]">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-[10px] font-bold text-violet-500">
                    {m.with.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[var(--text-hi)]">with {m.with}</p>
                    <p className="text-[11px] text-[var(--text-lo)]">{new Date(m.scheduled_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
                  </div>
                </Link>
              )) : (
                <p className="rounded-xl bg-[var(--surface-2)] px-3 py-4 text-sm text-[var(--text-lo)]">No 1-on-1s scheduled.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    );
  }

  // ── Org / Team view ───────────────────────────────────────────────────────
  const kpis: StatDef[] = [
    { label: "Open Roles",        value: stats.openJobs,        icon: "solar:case-broken",                    accent: "text-brand-500",  accentBg: "bg-brand-500/10",     href: "/hire/jobs" },
    { label: "Active Pipeline",   value: stats.activePipeline,  icon: "solar:users-group-two-rounded-broken",  accent: "text-blue-500",   accentBg: "bg-blue-500/10",      href: "/hire/candidates" },
    { label: "Awaiting Screen",   value: stats.pendingScreen,   icon: "solar:cpu-bolt-broken",                accent: stats.pendingScreen > 0 ? "text-amber-500" : "text-[var(--text-lo)]", accentBg: stats.pendingScreen > 0 ? "bg-amber-500/10" : "bg-[var(--surface-2)]", href: "/hire/candidates", note: stats.pendingScreen > 0 ? "AI screening needed" : undefined },
    { label: "Employees",         value: stats.activeEmployees, icon: "solar:people-nearby-broken",           accent: "text-green-500",  accentBg: "bg-green-500/10",     href: "/staff" },
    { label: "Hired",             value: stats.hired,           icon: "solar:check-circle-broken",            accent: "text-violet-500", accentBg: "bg-violet-500/10",    href: "/hire/candidates?stage=hired" },
  ];

  return (
    <div className="-mt-6 space-y-6 md:-mt-8">

      <DashboardHeader
        range={range}
        description={`${stats.openJobs} open role${stats.openJobs !== 1 ? "s" : ""} · ${stats.activePipeline} in pipeline · ${stats.hired} hired`}
      />

      {heroBanner}

      {/* ── KPI row ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((stat) => <KpiCard key={stat.label} stat={stat} />)}
      </div>

      {/* ── Operating queue ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/15"><Icon icon="solar:checklist-broken" className="h-3.5 w-3.5 text-brand-500" /></div>
            <div><h2 className="text-md font-semibold text-[var(--text-hi)]">My action items</h2><p className="text-[11px] text-[var(--text-lo)]">Items that need attention</p></div>
          </div>
          <div className="space-y-2">
            {operations.actionItems.length ? operations.actionItems.map((item) => (
              <Link key={item.label} href={item.href} className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] px-3 py-2.5 transition-colors hover:bg-brand-500/10">
                <span className="text-sm text-[var(--text-hi)]">{item.label}</span>
                <span className={`rounded-lg px-2 py-0.5 font-mono text-xs font-bold ${item.tone === "red" ? "bg-red-500/10 text-red-500" : item.tone === "amber" ? "bg-amber-500/10 text-amber-500" : "bg-blue-500/10 text-blue-500"}`}>{item.count}</span>
              </Link>
            )) : <p className="rounded-xl bg-green-500/5 px-3 py-4 text-sm text-green-600">You&apos;re all caught up.</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
          <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2.5"><div className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-500/15"><Icon icon="solar:calendar-broken" className="h-3.5 w-3.5 text-violet-500" /></div><div><h2 className="text-md font-semibold text-[var(--text-hi)]">Interview queue</h2><p className="text-[11px] text-[var(--text-lo)]">Scorecards still to complete</p></div></div><Link href="/hire/candidates?stage=interview" className="text-xs text-brand-500 hover:underline">View all</Link></div>
          <div className="space-y-2">
            {operations.interviewQueue.length ? operations.interviewQueue.map((candidate) => <Link key={candidate.id} href={`/hire/candidates/${candidate.id}/interview`} className="flex items-center justify-between rounded-xl px-2 py-2 transition-colors hover:bg-[var(--surface-2)]"><div><p className="text-sm font-medium text-[var(--text-hi)]">{candidate.full_name}</p><p className="text-[11px] text-[var(--text-lo)]">{candidate.jobs?.title ?? "Role"}</p></div><Icon icon="solar:arrow-right-broken" className="h-4 w-4 text-[var(--text-lo)]" /></Link>) : <p className="rounded-xl bg-[var(--surface-2)] px-3 py-4 text-sm text-[var(--text-lo)]">No interviews waiting for a scorecard.</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
          <div className="mb-4 flex items-center gap-2.5"><div className="flex h-7 w-7 items-center justify-center rounded-xl bg-cyan-500/15"><Icon icon="solar:users-group-two-rounded-broken" className="h-3.5 w-3.5 text-cyan-500" /></div><div><h2 className="text-md font-semibold text-[var(--text-hi)]">Team pulse</h2><p className="text-[11px] text-[var(--text-lo)]">This week&apos;s check-ins and goals</p></div></div>
          <div className="grid grid-cols-2 gap-2">
            {[{ label: "Check-ins due", value: operations.pulse.pendingCheckins, href: "/pulse/checkins" }, { label: "Low mood", value: operations.pulse.lowMood, href: "/pulse/checkins" }, { label: "Blockers", value: operations.pulse.blockers, href: "/pulse/checkins" }, { label: "Goals at risk", value: operations.pulse.atRiskGoals, href: "/pulse/goals" }].map((item) => <Link key={item.label} href={item.href} className="rounded-xl bg-[var(--surface-2)] p-3 transition-colors hover:bg-cyan-500/10"><p className="font-mono text-xl font-bold text-[var(--text-hi)]">{item.value}</p><p className="mt-1 text-[11px] text-[var(--text-lo)]">{item.label}</p></Link>)}
          </div>
        </section>
      </div>

      {/* ── Second ops row: 1-on-1s, Goals, New hires, Surveys ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {/* Upcoming 1-on-1s */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-500/15">
                <Icon icon="solar:chat-round-dots-broken" className="h-3.5 w-3.5 text-violet-500" />
              </div>
              <div>
                <h2 className="text-md font-semibold text-[var(--text-hi)]">Upcoming 1-on-1s</h2>
                <p className="text-[11px] text-[var(--text-lo)]">Next scheduled meetings</p>
              </div>
            </div>
            <Link href="/pulse/one-on-ones" className="text-xs text-brand-500 hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {operations.upcomingOneOnOnes.length ? operations.upcomingOneOnOnes.map((m) => (
              <Link key={m.id} href="/pulse/one-on-ones" className="flex items-start gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-[var(--surface-2)]">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-[10px] font-bold text-violet-500">
                  {m.report.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-[var(--text-hi)]">{m.report}</p>
                  <p className="text-[11px] text-[var(--text-lo)]">with {m.manager} · {new Date(m.scheduled_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
                </div>
              </Link>
            )) : (
              <p className="rounded-xl bg-[var(--surface-2)] px-3 py-4 text-sm text-[var(--text-lo)]">No 1-on-1s scheduled.</p>
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
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/15">
                <Icon icon="solar:confetti-minimalistic-broken" className="h-3.5 w-3.5 text-amber-500" />
              </div>
              <div>
                <h2 className="text-md font-semibold text-[var(--text-hi)]">New hires</h2>
                <p className="text-[11px] text-[var(--text-lo)]">Joined in the last 30 days</p>
              </div>
            </div>
            <Link href="/staff" className="text-xs text-brand-500 hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {operations.newHires.length ? operations.newHires.map((hire) => (
              <Link key={hire.id} href={`/staff/${hire.id}`} className="flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-[var(--surface-2)]">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400/20 to-brand-500/20 text-[10px] font-bold text-amber-500">
                  {hire.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-[var(--text-hi)]">{hire.name}</p>
                  <p className="truncate text-[11px] text-[var(--text-lo)]">{hire.job_title ?? hire.department ?? "New employee"}</p>
                </div>
                <span className="shrink-0 text-[11px] text-[var(--text-lo)]">
                  {new Date(hire.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              </Link>
            )) : (
              <p className="rounded-xl bg-[var(--surface-2)] px-3 py-4 text-sm text-[var(--text-lo)]">No new hires this month.</p>
            )}
          </div>
        </section>

        {/* Active surveys */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-pink-500/15">
                <Icon icon="solar:chart-2-broken" className="h-3.5 w-3.5 text-pink-500" />
              </div>
              <div>
                <h2 className="text-md font-semibold text-[var(--text-hi)]">Active surveys</h2>
                <p className="text-[11px] text-[var(--text-lo)]">Live and collecting responses</p>
              </div>
            </div>
            <Link href="/pulse/surveys" className="text-xs text-brand-500 hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {operations.activeSurveys.length ? operations.activeSurveys.map((survey) => (
              <Link key={survey.id} href={`/pulse/surveys/${survey.id}`} className="flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--surface-2)]">
                <p className="truncate text-xs font-medium text-[var(--text-hi)]">{survey.title}</p>
                <span className="ml-2 shrink-0 rounded-lg bg-pink-500/10 px-2 py-0.5 font-mono text-xs font-bold text-pink-500">
                  {survey.response_count}
                </span>
              </Link>
            )) : (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <Icon icon="solar:chart-2-broken" className="h-8 w-8 text-[var(--text-lo)] opacity-40" />
                <p className="text-xs text-[var(--text-lo)]">No active surveys.</p>
                <Link href="/pulse/surveys" className="text-xs font-semibold text-brand-500 hover:underline">Create one</Link>
              </div>
            )}
          </div>
        </section>

      </div>

      {/* ── Middle row: Pipeline + Quick actions ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Pipeline funnel */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/50 hover:shadow-2xl dark:shadow-black/20 p-5 transition-shadow duration-200">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/15">
                <Icon icon="solar:graph-broken" className="h-3.5 w-3.5 text-brand-500" />
              </div>
              <h2 className="text-md font-semibold text-[var(--text-hi)]">Hiring Pipeline</h2>
            </div>
            <Link href="/hire/pipeline" className="flex items-center gap-1 text-xs text-brand-500 hover:underline">
              View <Icon icon="solar:arrow-right-broken" className="h-3.5 w-3.5" />
            </Link>
          </div>
          <PipelineFunnel stages={pipeline} />
          <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3">
            <span className="text-xs text-[var(--text-lo)]">Total active</span>
            <span className="font-mono text-sm font-bold text-[var(--text-hi)]">
              {pipeline.filter(s => s.stage !== "rejected").reduce((a, b) => a + b.count, 0)}
            </span>
          </div>
        </div>

        {/* Top roles by volume */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/50 hover:shadow-2xl dark:shadow-black/20 p-5 transition-shadow duration-200">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/15">
                <Icon icon="solar:case-broken" className="h-3.5 w-3.5 text-amber-500" />
              </div>
              <div>
                <h2 className="text-md font-semibold text-[var(--text-hi)]">Top roles</h2>
                <p className="text-[11px] text-[var(--text-lo)]">Most active by applicant volume</p>
              </div>
            </div>
            <Link href="/hire/jobs" className="flex items-center gap-1 text-xs text-brand-500 hover:underline">
              All jobs <Icon icon="solar:arrow-right-broken" className="h-3.5 w-3.5" />
            </Link>
          </div>
          {rolePipeline.length ? (
            <div className="space-y-3">
              {rolePipeline.slice(0, 6).map((r) => {
                const total = r.applied + r.screened + r.interview + r.offer || 1;
                const stages = [
                  { key: "applied",   val: r.applied,   color: "#94a3b8" },
                  { key: "screened",  val: r.screened,  color: "#60a5fa" },
                  { key: "interview", val: r.interview, color: "#a78bfa" },
                  { key: "offer",     val: r.offer,     color: "#fbbf24" },
                ];
                return (
                  <Link
                    key={r.role}
                    href={`/hire/candidates?role=${encodeURIComponent(r.role)}`}
                    className="group -mx-2 block rounded-xl px-2 py-2 transition-colors hover:bg-[var(--surface-2)]"
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium text-[var(--text-hi)] group-hover:text-brand-500 transition-colors">{r.role}</span>
                      <span className="shrink-0 font-mono text-xs text-[var(--text-lo)]">{r.applied}</span>
                    </div>
                    <div className="flex h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                      {stages.map((s) => s.val > 0 && (
                        <div
                          key={s.key}
                          className="h-full"
                          style={{ width: `${(s.val / total) * 100}%`, backgroundColor: s.color }}
                          title={`${s.key}: ${s.val}`}
                        />
                      ))}
                    </div>
                  </Link>
                );
              })}
              {/* Legend */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
                {[{ label: "Applied", color: "#94a3b8" }, { label: "Screened", color: "#60a5fa" }, { label: "Interview", color: "#a78bfa" }, { label: "Offer", color: "#fbbf24" }].map((l) => (
                  <div key={l.label} className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: l.color }} />
                    <span className="text-[10px] text-[var(--text-lo)]">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="rounded-xl bg-[var(--surface-2)] px-3 py-4 text-sm text-[var(--text-lo)]">No active roles.</p>
          )}
        </div>
      </div>

      {/* ── Charts row ── */}
      <DashboardCharts trend={trend} pipeline={pipeline} rolePipeline={rolePipeline} teamPulseTrend={teamPulseTrend} />

      {/* ── Hiring health, offers and schedules ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
          <h2 className="text-md font-semibold text-[var(--text-hi)]">Hiring health</h2><p className="mt-1 text-[11px] text-[var(--text-lo)]">Flow and bottlenecks across active roles</p>
          <Link href="/hire/candidates" className="mt-4 block rounded-xl transition-colors hover:bg-[var(--surface-2)]"><HiringHealthChart stages={stageAging} stalled={operations.health.stalledCandidates} averageDays={operations.health.averageDaysToHire} /></Link>
        </section>
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
          <h2 className="text-md font-semibold text-[var(--text-hi)]">Pipeline outcomes</h2><p className="mt-1 text-[11px] text-[var(--text-lo)]">Pending offers and completed candidate outcomes</p>
          <div className="mt-4"><OfferTrackerChart pending={operations.health.offerPending} accepted={operations.health.offerAccepted} declined={operations.health.offerDeclined} /></div>
        </section>
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
          <div className="flex items-center justify-between"><div><h2 className="text-md font-semibold text-[var(--text-hi)]">Role schedule</h2><p className="mt-1 text-[11px] text-[var(--text-lo)]">Publishing and closing soon</p></div><Link href="/hire/jobs" className="text-xs text-brand-500 hover:underline">Jobs</Link></div>
          <div className="mt-3 space-y-2">{operations.scheduledJobs.length ? operations.scheduledJobs.map((job) => { const date = job.kind === "publishes" ? job.published_at : job.closes_at; return <Link key={`${job.id}-${job.kind}`} href={`/hire/jobs/${job.id}`} className="flex items-center justify-between rounded-xl px-2 py-2 hover:bg-[var(--surface-2)]"><div className="min-w-0"><p className="truncate text-sm font-medium text-[var(--text-hi)]">{job.title}</p><p className="text-[11px] text-[var(--text-lo)]">{job.kind === "publishes" ? "Publishes" : "Closes"} {date ? new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}</p></div><Icon icon="solar:calendar-mark-broken" className="h-4 w-4 shrink-0 text-brand-500" /></Link>; }) : <p className="rounded-xl bg-[var(--surface-2)] px-3 py-4 text-sm text-[var(--text-lo)]">No scheduled role changes.</p>}</div>
        </section>
      </div>

    </div>
  );
}
