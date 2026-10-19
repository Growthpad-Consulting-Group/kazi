import { supabaseAdmin } from "@/lib/supabase";
import type { CandidateStage } from "@/types/database";

const STAGE_ORDER: CandidateStage[] = ["applied", "screened", "interview", "offer", "hired", "rejected"];

async function getReportData() {
  const [candidatesRes, jobsRes] = await Promise.all([
    supabaseAdmin
      .from("candidates")
      .select("id, stage, applied_at, ai_score, shortlisted, jobs(title, department)"),
    supabaseAdmin.from("jobs").select("id, title, status, created_at"),
  ]);

  const candidates = (candidatesRes.data ?? []) as unknown as {
    id: string;
    stage: CandidateStage;
    applied_at: string;
    ai_score: number | null;
    shortlisted: boolean;
    jobs: { title: string; department: string | null } | null;
  }[];

  const jobs = jobsRes.data ?? [];

  // Funnel: count per stage
  const funnel = STAGE_ORDER.map((stage) => ({
    stage,
    count: candidates.filter((c) => c.stage === stage).length,
  }));

  // Time to hire: avg days from applied_at to hired (approximated — would need hired_at col in Phase 2)
  // For now show avg days in pipeline for active candidates
  const activeDays = candidates
    .filter((c) => !["hired", "rejected"].includes(c.stage))
    .map((c) => Math.floor((Date.now() - new Date(c.applied_at).getTime()) / 86400000));
  const avgDaysInPipeline =
    activeDays.length > 0
      ? Math.round(activeDays.reduce((a, b) => a + b, 0) / activeDays.length)
      : null;

  // Source breakdown
  const sourceRes = await supabaseAdmin
    .from("candidates")
    .select("source");
  const sourceCounts: Record<string, number> = {};
  for (const c of sourceRes.data ?? []) {
    const s = (c as { source: string | null }).source ?? "direct";
    sourceCounts[s] = (sourceCounts[s] ?? 0) + 1;
  }

  // AI score distribution
  const scored = candidates.filter((c) => c.ai_score !== null);
  const avgScore =
    scored.length > 0
      ? Math.round(scored.reduce((a, c) => a + (c.ai_score ?? 0), 0) / scored.length)
      : null;
  const shortlisted = candidates.filter((c) => c.shortlisted).length;

  return {
    totalCandidates: candidates.length,
    totalJobs: jobs.length,
    openJobs: jobs.filter((j) => j.status === "open").length,
    funnel,
    avgDaysInPipeline,
    sourceCounts,
    avgScore,
    shortlisted,
    screened: scored.length,
  };
}

export default async function ReportingPage() {
  const d = await getReportData();
  const maxFunnel = Math.max(...d.funnel.map((f) => f.count), 1);

  const stageColors: Record<CandidateStage, string> = {
    applied: "bg-slate-400",
    screened: "bg-blue-500",
    interview: "bg-violet-500",
    offer: "bg-amber-400",
    hired: "bg-green-500",
    rejected: "bg-red-400",
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Recruitment Reporting</h1>
        <p className="mt-1 text-sm text-slate-500">Overview across all roles</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Candidates", value: d.totalCandidates },
          { label: "Open Roles", value: d.openJobs },
          { label: "Screened by AI", value: d.screened },
          { label: "Shortlisted", value: d.shortlisted },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Funnel */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Candidate Funnel</h2>
          <div className="space-y-2">
            {d.funnel.map(({ stage, count }) => (
              <div key={stage} className="flex items-center gap-3">
                <span className="w-20 text-xs text-slate-500 capitalize text-right flex-shrink-0">
                  {stage}
                </span>
                <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${stageColors[stage]}`}
                    style={{ width: `${(count / maxFunnel) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-xs font-semibold text-slate-700 text-right">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Source breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Source of Applicants</h2>
          {Object.keys(d.sourceCounts).length === 0 ? (
            <p className="text-sm text-slate-400">No data yet</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(d.sourceCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([source, count]) => {
                  const pct = Math.round((count / d.totalCandidates) * 100);
                  return (
                    <div key={source} className="flex items-center gap-3">
                      <span className="w-24 text-xs text-slate-500 capitalize text-right flex-shrink-0">
                        {source.replace("_", " ")}
                      </span>
                      <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-400 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-8 text-xs font-semibold text-slate-700 text-right">
                        {count}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* AI screening stats */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">AI Screening</h2>
          <div className="space-y-3">
            <Metric label="Average AI Score" value={d.avgScore !== null ? `${d.avgScore}/100` : "—"} />
            <Metric
              label="Shortlist Rate"
              value={
                d.screened > 0
                  ? `${Math.round((d.shortlisted / d.screened) * 100)}%`
                  : "—"
              }
            />
            <Metric label="Candidates Screened" value={`${d.screened} / ${d.totalCandidates}`} />
          </div>
        </div>

        {/* Time in pipeline */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Pipeline Velocity</h2>
          <div className="space-y-3">
            <Metric
              label="Avg Days in Pipeline (active)"
              value={d.avgDaysInPipeline !== null ? `${d.avgDaysInPipeline} days` : "—"}
            />
            <Metric label="Total Jobs Created" value={d.totalJobs} />
            <Metric label="Open Jobs" value={d.openJobs} />
          </div>
          <p className="text-xs text-slate-400 mt-4">
            Time-to-hire tracking will be available once hired_at timestamps are recorded.
          </p>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}
