import { Icon } from "@iconify/react";
import { supabaseAdmin } from "@/lib/supabase";
import SetPageHeader from "@/components/ui/SetPageHeader";
import StatCard from "@/components/ui/StatCard";
import { ReportingCharts } from "./ReportingCharts";
import type { CandidateStage } from "@/types/database";

const STAGE_ORDER: CandidateStage[] = ["applied", "screened", "interview", "offer", "hired", "rejected"];
const ACTIVE_STAGES: CandidateStage[] = ["applied", "screened", "interview", "offer"];

type CandidateRecord = {
  id: string; stage: CandidateStage; applied_at: string; ai_score: number | null; shortlisted: boolean; source: string | null;
  jobs: { title: string; department: string | null } | null;
};

async function getReportData() {
  const [candidatesRes, jobsRes] = await Promise.all([
    supabaseAdmin.from("candidates").select("id, stage, applied_at, ai_score, shortlisted, source, jobs(title, department)"),
    supabaseAdmin.from("jobs").select("id, title, status"),
  ]);
  const candidates = (candidatesRes.data ?? []) as unknown as CandidateRecord[];
  const jobs = jobsRes.data ?? [];
  const funnel = STAGE_ORDER.map((stage) => ({ stage, count: candidates.filter((candidate) => candidate.stage === stage).length }));
  const active = candidates.filter((candidate) => ACTIVE_STAGES.includes(candidate.stage));
  const screened = candidates.filter((candidate) => candidate.ai_score !== null);
  const shortlisted = candidates.filter((candidate) => candidate.shortlisted).length;
  const activeDays = active.map((candidate) => Math.floor((Date.now() - new Date(candidate.applied_at).getTime()) / 86_400_000));
  const avgDaysInPipeline = activeDays.length ? Math.round(activeDays.reduce((sum, days) => sum + days, 0) / activeDays.length) : null;
  const stalled = activeDays.filter((days) => days >= 14).length;

  const sources = new Map<string, { applicants: number; shortlisted: number; scores: number[] }>();
  const roles = new Map<string, { applicants: number; active: number; interviews: number; offers: number }>();
  for (const candidate of candidates) {
    const source = candidate.source?.replaceAll("_", " ") || "Direct";
    const sourceData = sources.get(source) ?? { applicants: 0, shortlisted: 0, scores: [] };
    sourceData.applicants += 1; sourceData.shortlisted += Number(candidate.shortlisted);
    if (candidate.ai_score !== null) sourceData.scores.push(candidate.ai_score);
    sources.set(source, sourceData);

    const role = candidate.jobs?.title ?? "Unassigned role";
    const roleData = roles.get(role) ?? { applicants: 0, active: 0, interviews: 0, offers: 0 };
    roleData.applicants += 1; roleData.active += Number(ACTIVE_STAGES.includes(candidate.stage));
    roleData.interviews += Number(candidate.stage === "interview"); roleData.offers += Number(candidate.stage === "offer");
    roles.set(role, roleData);
  }

  const start = new Date(); start.setDate(start.getDate() - 49); start.setHours(0, 0, 0, 0);
  const applications = Array.from({ length: 8 }, (_, index) => {
    const weekStart = new Date(start); weekStart.setDate(start.getDate() + index * 7);
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 7);
    return { week: weekStart.toLocaleDateString("en-KE", { month: "short", day: "numeric" }), applications: candidates.filter((candidate) => {
      const date = new Date(candidate.applied_at); return date >= weekStart && date < weekEnd;
    }).length };
  });

  return {
    totalCandidates: candidates.length, activeCandidates: active.length, openJobs: jobs.filter((job) => job.status === "open").length,
    awaitingReview: funnel.find((item) => item.stage === "applied")?.count ?? 0,
    interviews: funnel.find((item) => item.stage === "interview")?.count ?? 0,
    offers: funnel.find((item) => item.stage === "offer")?.count ?? 0,
    screened: screened.length, shortlisted, avgScore: screened.length ? Math.round(screened.reduce((sum, candidate) => sum + (candidate.ai_score ?? 0), 0) / screened.length) : null,
    avgDaysInPipeline, stalled, funnel, applications,
    sources: [...sources.entries()].map(([source, data]) => ({ source, applicants: data.applicants, shortlisted: data.shortlisted, avgScore: data.scores.length ? Math.round(data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length) : null })).sort((a, b) => b.applicants - a.applicants).slice(0, 6),
    roles: [...roles.entries()].map(([role, data]) => ({ role, ...data })).sort((a, b) => b.active - a.active || b.applicants - a.applicants).slice(0, 5),
  };
}

export default async function ReportingPage() {
  const report = await getReportData();
  const shortlistRate = report.screened ? Math.round((report.shortlisted / report.screened) * 100) : null;
  return (
    <div className="space-y-5">
      <SetPageHeader title="Hiring insights" description={`${report.activeCandidates} active candidates across ${report.openJobs} open role${report.openJobs === 1 ? "" : "s"}`} icon="solar:chart-2-broken" />
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard title="Active pipeline" value={report.activeCandidates} icon="solar:users-group-two-rounded-broken" color="orange" compact subtitle={`${report.awaitingReview} awaiting review`} />
        <StatCard title="Interviews" value={report.interviews} icon="solar:calendar-broken" color="blue" compact subtitle={`${report.offers} offer${report.offers === 1 ? "" : "s"} in play`} />
        <StatCard title="Screening quality" value={report.avgScore === null ? "—" : `${report.avgScore}/100`} icon="solar:magic-stick-3-broken" color="green" compact subtitle={shortlistRate === null ? "No screened candidates" : `${shortlistRate}% shortlist rate`} />
        <StatCard title="Pipeline health" value={report.avgDaysInPipeline === null ? "—" : `${report.avgDaysInPipeline}d`} icon="solar:hourglass-line-broken" color="amber" compact subtitle={report.stalled ? `${report.stalled} stalled 14+ days` : "No stalled candidates"} />
      </section>
      <ReportingCharts funnel={report.funnel} applications={report.applications} sources={report.sources} />
      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/30 dark:shadow-black/20">
          <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-base font-semibold text-[var(--text-hi)]">Roles with the most movement</h2><p className="mt-1 text-xs text-[var(--text-lo)]">Where your active hiring attention is concentrated.</p></div><span className="rounded-lg bg-[#f05d23]/10 px-2 py-1 font-mono text-[10px] font-bold text-[#d94f1c]">Live</span></div>
          <div className="space-y-2">{report.roles.length ? report.roles.map((role) => <div key={role.role} className="flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-colors hover:border-[var(--border)] hover:bg-[var(--surface-2)]"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-xs font-bold text-blue-600">{role.role.slice(0, 1)}</div><p className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text-hi)]">{role.role}</p><div className="hidden gap-4 text-right sm:flex"><RoleMetric label="Active" value={role.active} /><RoleMetric label="Interview" value={role.interviews} /><RoleMetric label="Offer" value={role.offers} /></div><span className="font-mono text-xs font-bold text-[var(--text-hi)] sm:hidden">{role.active}</span></div>) : <EmptyState text="Candidates will appear here as applications come in." />}</div>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/30 dark:shadow-black/20"><h2 className="text-base font-semibold text-[var(--text-hi)]">Hiring notes</h2><p className="mt-1 text-xs text-[var(--text-lo)]">The signals worth acting on right now.</p><div className="mt-4 space-y-3"><Insight icon="solar:eye-broken" tone="orange" text={report.awaitingReview ? `${report.awaitingReview} candidate${report.awaitingReview === 1 ? " is" : "s are"} waiting for first review.` : "All incoming candidates have been reviewed."} /><Insight icon="solar:clock-circle-broken" tone="amber" text={report.stalled ? `${report.stalled} active candidate${report.stalled === 1 ? " has" : "s have"} spent 14+ days in the pipeline.` : "No candidates have been stalled for 14+ days."} /><Insight icon="solar:medal-ribbon-star-broken" tone="green" text={shortlistRate === null ? "Screen candidates to start measuring quality." : `${shortlistRate}% of screened candidates have been shortlisted.`} /></div></div>
      </section>
    </div>
  );
}

function RoleMetric({ label, value }: { label: string; value: number }) { return <div><p className="text-[10px] text-[var(--text-lo)]">{label}</p><p className="font-mono text-xs font-bold text-[var(--text-hi)]">{value}</p></div>; }
function Insight({ icon, tone, text }: { icon: string; tone: "orange" | "amber" | "green"; text: string }) { const tones = { orange: "bg-[#f05d23]/10 text-[#d94f1c]", amber: "bg-amber-500/10 text-amber-600", green: "bg-green-500/10 text-green-600" }; return <div className="flex gap-3 rounded-xl bg-[var(--surface-2)] p-3"><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}><Icon icon={icon} className="h-4 w-4" /></span><p className="pt-0.5 text-xs leading-5 text-[var(--text-lo)]">{text}</p></div>; }
function EmptyState({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-lo)]">{text}</div>; }
