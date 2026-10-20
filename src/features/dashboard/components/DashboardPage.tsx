import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { StatusPill } from "@/components/ui/StatusPill";
import DashboardCharts from "./DashboardCharts";
import DashboardHeader from "./DashboardHeader";
import { resolveRange } from "./DashboardRange";
import { getDashboardData } from "../data";
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
      className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/50 hover:shadow-2xl dark:shadow-black/20 p-5 transition-all duration-300 hover:border-[#f05d23]/30 hover:-translate-y-0.5 block"
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
      <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-gradient-to-r from-[#f05d23] to-[#f05d23]/0 transition-all duration-500 group-hover:w-full" />
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

const QUICK_ACTIONS = [
  { label: "Post Job",      href: "/hire/jobs/new",       icon: "solar:add-circle-broken",              color: "#f05d23", bg: "bg-[#f05d23]/10" },
  { label: "Pipeline",      href: "/hire/pipeline",       icon: "solar:graph-broken",                   color: "#a78bfa", bg: "bg-violet-500/10" },
  { label: "Candidates",    href: "/hire/candidates",     icon: "solar:users-group-two-rounded-broken",  color: "#60a5fa", bg: "bg-blue-500/10" },
  { label: "All Jobs",      href: "/hire/jobs",           icon: "solar:case-broken",                    color: "#4ade80", bg: "bg-green-500/10" },
  { label: "Team",          href: "/people",              icon: "solar:people-nearby-broken",           color: "#fbbf24", bg: "bg-amber-500/10" },
  { label: "Reviews",       href: "/pulse/reviews",       icon: "solar:star-circle-broken",             color: "#f472b6", bg: "bg-pink-500/10" },
  { label: "Check-ins",     href: "/pulse/checkins",      icon: "solar:clipboard-check-broken",         color: "#67e8f9", bg: "bg-cyan-500/10" },
  { label: "Analytics",     href: "/pulse/analytics",     icon: "solar:chart-square-broken",            color: "#5eead4", bg: "bg-teal-500/10" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ from?: string; to?: string; preset?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const range = resolveRange(params);

  const session = await getServerSession(authOptions);
  const { stats, pipeline, recent, trend } = await getDashboardData(range);

  const firstName = session?.user.name?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? { text: "Good morning", icon: "solar:sun-fog-broken" }
    : hour < 17 ? { text: "Good afternoon", icon: "solar:sun-broken" }
    : hour < 21 ? { text: "Good evening", icon: "solar:moon-stars-broken" }
    : { text: "Working late", icon: "solar:moon-sleep-broken" };

  const kpis: StatDef[] = [
    { label: "Open Roles",        value: stats.openJobs,        icon: "solar:case-broken",                    accent: "text-[#f05d23]",  accentBg: "bg-[#f05d23]/10",     href: "/hire/jobs" },
    { label: "Active Pipeline",   value: stats.activePipeline,  icon: "solar:users-group-two-rounded-broken",  accent: "text-blue-500",   accentBg: "bg-blue-500/10",      href: "/hire/candidates" },
    { label: "Awaiting Screen",   value: stats.pendingScreen,   icon: "solar:cpu-bolt-broken",                accent: stats.pendingScreen > 0 ? "text-amber-500" : "text-[var(--text-lo)]", accentBg: stats.pendingScreen > 0 ? "bg-amber-500/10" : "bg-[var(--surface-2)]", href: "/hire/candidates", note: stats.pendingScreen > 0 ? "AI screening needed" : undefined },
    { label: "Employees",         value: stats.activeEmployees, icon: "solar:people-nearby-broken",           accent: "text-green-500",  accentBg: "bg-green-500/10",     href: "/people" },
    { label: "Hired",             value: stats.hired,           icon: "solar:check-circle-broken",            accent: "text-violet-500", accentBg: "bg-violet-500/10",    href: "/hire/candidates?stage=hired" },
  ];

  return (
    <div className="space-y-6">

      <DashboardHeader
        range={range}
        description={`${stats.openJobs} open role${stats.openJobs !== 1 ? "s" : ""} · ${stats.activePipeline} in pipeline · ${stats.hired} hired`}
      />

      {/* ── Hero banner ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a0a04] via-[#2d1107] to-[#0f0f14] p-7 shadow-2xl">
        {/* Decorative orbs */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#f05d23] opacity-[0.07] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 left-1/3 h-48 w-48 rounded-full bg-violet-500 opacity-[0.06] blur-3xl" />
        <div className="pointer-events-none absolute right-1/4 top-1/2 h-32 w-32 rounded-full bg-amber-400 opacity-[0.05] blur-2xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#f05d23]/20 backdrop-blur-sm">
                <Icon icon={greeting.icon} className="h-5 w-5 text-amber-300" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {greeting.text}, {firstName}
              </h1>
            </div>
            <p className="mt-2 text-sm text-white/50 capitalize">
              {session?.user.role?.replace("_", " ")} · {session?.user.department ?? "Growthpad"}
            </p>

            {/* Inline hero stats */}
            <div className="mt-5 flex flex-wrap gap-3">
              {[
                { label: "Open Jobs",   value: stats.openJobs,        color: "#f05d23" },
                { label: "In Pipeline", value: stats.activePipeline,  color: "#60a5fa" },
                { label: "Employees",   value: stats.activeEmployees, color: "#4ade80" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 backdrop-blur-sm">
                  <span className="font-mono text-xl font-bold" style={{ color: s.color }}>{s.value}</span>
                  <span className="text-xs text-white/50">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-right">
            <p className="text-sm font-semibold text-white/50">
              {new Date().toLocaleDateString("en-GB", { weekday: "long" })}
            </p>
            <p className="text-xs text-white/30">
              {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </p>
            {stats.pendingScreen > 0 && (
              <Link
                href="/hire/candidates"
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 text-xs font-medium text-amber-300 transition-all hover:bg-amber-500/30"
              >
                <Icon icon="solar:cpu-bolt-broken" className="h-3.5 w-3.5" />
                {stats.pendingScreen} awaiting AI screen
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((stat) => <KpiCard key={stat.label} stat={stat} />)}
      </div>

      {/* ── Middle row: Pipeline + Quick actions ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Pipeline funnel */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/50 hover:shadow-2xl dark:shadow-black/20 p-5 transition-shadow duration-200">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#f05d23]/15">
                <Icon icon="solar:graph-broken" className="h-3.5 w-3.5 text-[#f05d23]" />
              </div>
              <h2 className="text-md font-semibold text-[var(--text-hi)]">Hiring Pipeline</h2>
            </div>
            <Link href="/hire/pipeline" className="flex items-center gap-1 text-xs text-[#f05d23] hover:underline">
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

        {/* Quick actions */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/50 hover:shadow-2xl dark:shadow-black/20 p-5 transition-shadow duration-200">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-500/15">
              <Icon icon="solar:widget-broken" className="h-3.5 w-3.5 text-violet-500" />
            </div>
            <h2 className="text-md font-semibold text-[var(--text-hi)]">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {QUICK_ACTIONS.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="group flex flex-col items-center gap-2 rounded-xl p-3 text-center transition-all hover:bg-[var(--surface-2)] active:scale-95"
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${a.bg} transition-transform duration-200 group-hover:scale-110`}
                >
                  <Icon icon={a.icon} className="h-5 w-5" style={{ color: a.color }} />
                </div>
                <span className="text-xs font-medium leading-tight text-[var(--text-lo)] group-hover:text-[var(--text-hi)]">
                  {a.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Charts row ── */}
      <DashboardCharts trend={trend} pipeline={pipeline} />

      {/* ── Recent candidates ── */}
      {recent.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/50 hover:shadow-2xl dark:shadow-black/20 overflow-hidden transition-shadow duration-200">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-500/15">
                <Icon icon="solar:users-group-two-rounded-broken" className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <h2 className="text-md font-semibold text-[var(--text-hi)]">Recent Candidates</h2>
            </div>
            <Link href="/hire/candidates" className="flex items-center gap-1 text-xs text-[#f05d23] hover:underline">
              View all <Icon icon="solar:arrow-right-broken" className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-[var(--border)]">
            {recent.map((c) => (
              <Link
                key={c.id}
                href={`/hire/candidates/${c.id}`}
                className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--surface-2)]"
              >
                {/* Avatar initials */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#f05d23]/20 to-violet-500/20 text-xs font-bold text-[var(--text-hi)]">
                  {c.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-md font-semibold text-[var(--text-hi)] truncate">{c.full_name}</p>
                  <p className="text-xs text-[var(--text-lo)] truncate">{c.jobs?.title ?? "—"}</p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {c.ai_score !== null && (
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-[var(--surface-2)]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${c.ai_score}%`,
                            backgroundColor: c.ai_score >= 75 ? "#4ade80" : c.ai_score >= 50 ? "#fbbf24" : "#f87171",
                          }}
                        />
                      </div>
                      <span className={`font-mono text-xs font-bold tabular-nums ${c.ai_score >= 75 ? "text-green-500" : c.ai_score >= 50 ? "text-amber-500" : "text-red-400"}`}>
                        {c.ai_score}
                      </span>
                    </div>
                  )}
                  <StatusPill value={c.stage} context="stage" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
