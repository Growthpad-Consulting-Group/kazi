import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import Link from "next/link";

async function getStats() {
  const [jobs, candidates, pending] = await Promise.all([
    supabaseAdmin.from("jobs").select("id", { count: "exact" }).eq("status", "open"),
    supabaseAdmin
      .from("candidates")
      .select("id", { count: "exact" })
      .not("stage", "in", '("hired","rejected")'),
    supabaseAdmin
      .from("candidates")
      .select("id", { count: "exact" })
      .eq("stage", "applied")
      .is("ai_score", null),
  ]);

  return {
    openJobs: jobs.count ?? 0,
    activeCandidates: candidates.count ?? 0,
    pendingReview: pending.count ?? 0,
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
    .limit(5);
  return (data ?? []) as unknown as RecentCandidate[];
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const [stats, recent] = await Promise.all([getStats(), getRecentCandidates()]);

  const stageDot: Record<string, string> = {
    applied: "bg-slate-400",
    screened: "bg-blue-400",
    interview: "bg-violet-500",
    offer: "bg-amber-400",
    hired: "bg-green-500",
    rejected: "bg-red-400",
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">
        Welcome back, {session?.user.name?.split(" ")[0]}
      </h1>
      <p className="mt-1 text-sm text-slate-500 capitalize">
        {session?.user.role.replace("_", " ")} · {session?.user.department ?? "Growthpad"}
      </p>

      {/* Stat cards */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Open Jobs"
          value={stats.openJobs}
          href="/hire/jobs"
          color="blue"
        />
        <StatCard
          label="Active Candidates"
          value={stats.activeCandidates}
          href="/hire/candidates"
          color="violet"
        />
        <StatCard
          label="Pending Screening"
          value={stats.pendingReview}
          href="/hire/candidates"
          color={stats.pendingReview > 0 ? "amber" : "slate"}
          note={stats.pendingReview > 0 ? "Need AI screening" : undefined}
        />
      </div>

      {/* Quick actions */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "New Job", href: "/hire/jobs/new", icon: "+" },
          { label: "Pipeline", href: "/hire/pipeline", icon: "⬡" },
          { label: "Candidates", href: "/hire/candidates", icon: "◎" },
          { label: "All Jobs", href: "/hire/jobs", icon: "≡" },
        ].map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:shadow transition-all"
          >
            <span className="text-lg">{a.icon}</span>
            {a.label}
          </Link>
        ))}
      </div>

      {/* Recent candidates */}
      {recent.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">Recent Candidates</h2>
            <Link href="/hire/candidates" className="text-xs text-blue-600 hover:underline">
              View all →
            </Link>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {recent.map((c, i) => (
              <Link
                key={c.id}
                href={`/hire/candidates/${c.id}`}
                className={`flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors ${
                  i > 0 ? "border-t border-slate-100" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${stageDot[c.stage] ?? "bg-slate-300"}`} />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{c.full_name}</p>
                    <p className="text-xs text-slate-400">{c.jobs?.title ?? "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {c.ai_score !== null && (
                    <span className={`text-xs font-semibold ${c.ai_score >= 65 ? "text-green-600" : "text-slate-400"}`}>
                      {c.ai_score}/100
                    </span>
                  )}
                  <span className="text-xs text-slate-400 capitalize">{c.stage}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
  color,
  note,
}: {
  label: string;
  value: number;
  href: string;
  color: "blue" | "violet" | "amber" | "slate";
  note?: string;
}) {
  const colors = {
    blue: "text-blue-600",
    violet: "text-violet-600",
    amber: "text-amber-600",
    slate: "text-slate-700",
  };
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow transition-shadow block"
    >
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${colors[color]}`}>{value}</p>
      {note && <p className="mt-1 text-xs text-amber-600">{note}</p>}
    </Link>
  );
}
