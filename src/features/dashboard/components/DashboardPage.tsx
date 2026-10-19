import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { StatCard } from "@/components/ui/StatCard";
import { StatusPill } from "@/components/ui/StatusPill";

async function getStats() {
  const [jobs, candidates, pending, employees, reviews] = await Promise.all([
    supabaseAdmin.from("jobs").select("id", { count: "exact" }).eq("status", "open"),
    supabaseAdmin.from("candidates").select("id", { count: "exact" }).not("stage", "in", '("hired","rejected")'),
    supabaseAdmin.from("candidates").select("id", { count: "exact" }).eq("stage", "applied").is("ai_score", null),
    supabaseAdmin.from("users").select("id", { count: "exact" }).eq("is_active", true),
    supabaseAdmin.from("performance_reviews").select("id", { count: "exact" }),
  ]);
  return {
    openJobs: jobs.count ?? 0,
    activeCandidates: candidates.count ?? 0,
    pendingReview: pending.count ?? 0,
    activeEmployees: employees.count ?? 0,
    inProgressReviews: reviews.count ?? 0,
  };
}

type RecentCandidate = {
  id: string;
  full_name: string;
  stage: string;
  applied_at: string;
  ai_score: number | null;
  jobs: { title: string } | null;
};

async function getRecentCandidates(): Promise<RecentCandidate[]> {
  const { data } = await supabaseAdmin
    .from("candidates")
    .select("id, full_name, stage, applied_at, ai_score, jobs(title)")
    .order("applied_at", { ascending: false })
    .limit(6);
  return (data ?? []) as unknown as RecentCandidate[];
}

function getGreeting(name: string) {
  const hour = new Date().getHours();
  if (hour < 12) return { text: `Good morning, ${name}`, icon: "solar:sun-fog-broken" };
  if (hour < 17) return { text: `Good afternoon, ${name}`, icon: "solar:sun-broken" };
  if (hour < 21) return { text: `Good evening, ${name}`, icon: "solar:moon-stars-broken" };
  return { text: `Working late, ${name}`, icon: "solar:moon-sleep-broken" };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const [stats, recent] = await Promise.all([getStats(), getRecentCandidates()]);

  const firstName = session?.user.name?.split(" ")[0] ?? "there";
  const greeting = getGreeting(firstName);

  const quickActions = [
    { label: "Post a Job",     href: "/hire/jobs/new",    icon: "solar:add-circle-broken",        color: "text-[#f05d23]",   bg: "bg-[#f05d23]/10" },
    { label: "Pipeline",       href: "/hire/pipeline",    icon: "solar:graph-broken",              color: "text-violet-500",  bg: "bg-violet-500/10" },
    { label: "Candidates",     href: "/hire/candidates",  icon: "solar:users-group-two-rounded-broken", color: "text-blue-500",    bg: "bg-blue-500/10" },
    { label: "Team",           href: "/people",           icon: "solar:people-nearby-broken",     color: "text-green-500",   bg: "bg-green-500/10" },
    { label: "Reviews",        href: "/pulse/reviews",    icon: "solar:star-circle-broken",        color: "text-amber-500",   bg: "bg-amber-500/10" },
    { label: "Check-ins",      href: "/pulse/checkins",   icon: "solar:clipboard-check-broken",   color: "text-cyan-500",    bg: "bg-cyan-500/10" },
  ];

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-hi)] tracking-tight">
              {greeting.text}
            </h1>
            <Icon icon={greeting.icon} className="w-7 h-7 text-amber-400" />
          </div>
          <p className="mt-1.5 text-sm text-[var(--text-lo)] capitalize">
            {session?.user.role?.replace("_", " ")} · {session?.user.department ?? "Growthpad"}
          </p>
        </div>
        <p className="text-xs font-medium text-[var(--text-lo)] sm:text-right">
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Open Jobs"
          value={stats.openJobs}
          icon="solar:case-broken"
          iconColor="text-[#f05d23]"
          iconBg="from-[#f05d23]/20 to-[#f05d23]/5"
          href="/hire/jobs"
        />
        <StatCard
          label="Active Pipeline"
          value={stats.activeCandidates}
          icon="solar:users-group-two-rounded-broken"
          iconColor="text-blue-500"
          iconBg="from-blue-500/20 to-blue-500/5"
          href="/hire/candidates"
        />
        <StatCard
          label="Awaiting Screen"
          value={stats.pendingReview}
          icon="solar:cpu-bolt-broken"
          iconColor={stats.pendingReview > 0 ? "text-amber-500" : "text-slate-400"}
          iconBg={stats.pendingReview > 0 ? "from-amber-500/20 to-amber-500/5" : "from-slate-500/10 to-slate-500/5"}
          note={stats.pendingReview > 0 ? "Need AI screening" : undefined}
          href="/hire/candidates"
        />
        <StatCard
          label="Active Employees"
          value={stats.activeEmployees}
          icon="solar:people-nearby-broken"
          iconColor="text-green-500"
          iconBg="from-green-500/20 to-green-500/5"
          href="/people"
        />
        <StatCard
          label="Reviews In Progress"
          value={stats.inProgressReviews}
          icon="solar:star-circle-broken"
          iconColor="text-violet-500"
          iconBg="from-violet-500/20 to-violet-500/5"
          href="/pulse/reviews"
        />
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-lo)]">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {quickActions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="flex flex-col items-center gap-2.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center transition-all hover:shadow-md hover:scale-[1.02] active:scale-95"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${a.bg}`}>
                <Icon icon={a.icon} className={`h-5 w-5 ${a.color}`} />
              </div>
              <span className="text-xs font-medium text-[var(--text-hi)]">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent candidates */}
      {recent.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-lo)]">Recent Candidates</h2>
            <Link href="/hire/candidates" className="flex items-center gap-1 text-xs font-medium text-[#f05d23] hover:underline">
              View all
              <Icon icon="solar:arrow-right-broken" className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            {recent.map((c, i) => (
              <Link
                key={c.id}
                href={`/hire/candidates/${c.id}`}
                className={`flex items-center justify-between px-4 py-3 hover:bg-[var(--surface-2)] transition-colors ${i > 0 ? "border-t border-[var(--border)]" : ""}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] border border-[var(--border)]">
                    <Icon icon="solar:user-broken" className="h-4 w-4 text-[var(--text-lo)]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-hi)] truncate">{c.full_name}</p>
                    <p className="text-xs text-[var(--text-lo)] truncate">{c.jobs?.title ?? "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  {c.ai_score !== null && (
                    <span className={`text-xs font-semibold tabular-nums ${c.ai_score >= 65 ? "text-green-500" : "text-[var(--text-lo)]"}`}>
                      {c.ai_score}/100
                    </span>
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
