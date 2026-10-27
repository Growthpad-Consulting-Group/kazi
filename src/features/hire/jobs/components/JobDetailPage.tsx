import Link from "next/link";
import { publicJobUrl } from "@/lib/careers-url";
import { notFound } from "next/navigation";
import { Icon } from "@iconify/react";
import { getJob } from "../actions";
import { supabaseAdmin } from "@/lib/supabase";
import type { JobStatus } from "@/types/database";
import SetPageHeader from "@/components/ui/SetPageHeader";
import PageWithSidebar from "@/components/ui/PageWithSidebar";
import SidebarWidget from "@/components/ui/SidebarWidget";
import StatCard from "@/components/ui/StatCard";

const STATUS_META: Record<JobStatus, { icon: string; chip: string; text: string; hint: string }> = {
  draft: {
    icon: "solar:eye-closed-broken",
    chip: "bg-slate-500/10 text-slate-500 dark:text-slate-400",
    text: "text-slate-600 dark:text-slate-300",
    hint: "Only visible to your team — nobody can apply yet.",
  },
  open: {
    icon: "solar:eye-broken",
    chip: "bg-green-500/10 text-green-500",
    text: "text-green-500",
    hint: "Accepting applications on your public careers page.",
  },
  closed: {
    icon: "solar:close-circle-broken",
    chip: "bg-red-500/10 text-red-500",
    text: "text-red-500",
    hint: "No longer accepting applications.",
  },
};

function SectionHeader({
  icon,
  iconBg,
  iconColor,
  title,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
}) {
  return (
    <div className="mb-5 flex items-center gap-2.5">
      <div className={`flex h-7 w-7 items-center justify-center rounded-xl ${iconBg}`}>
        <Icon icon={icon} className={`h-3.5 w-3.5 ${iconColor}`} />
      </div>
      <h2 className="text-md font-semibold text-[var(--text-hi)]">{title}</h2>
    </div>
  );
}

export default async function JobDetailPage({ id }: { id: string }) {
  const job = await getJob(id).catch(() => null);
  if (!job) notFound();

  const [candidateResult, departmentResult] = await Promise.all([
    supabaseAdmin
      .from("candidates")
      .select("id, full_name, stage, ai_score, shortlisted, applied_at")
      .eq("job_id", id)
      .order("applied_at", { ascending: false }),
    job.department
      ? supabaseAdmin.from("departments").select("id").eq("name", job.department).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const candidateRows = candidateResult.data;
  const candidates = candidateRows ?? [];
  const stageCounts = Object.fromEntries(
    ["applied", "screened", "interview", "offer", "hired", "rejected"].map((stage) => [stage, candidates.filter((candidate) => candidate.stage === stage).length])
  ) as Record<"applied" | "screened" | "interview" | "offer" | "hired" | "rejected", number>;
  const activeCandidates = candidates.filter((candidate) => !["hired", "rejected"].includes(candidate.stage)).length;

  const status = STATUS_META[job.status] ?? STATUS_META.draft;
  const rubricTotal = job.scoring_rubric.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);

  const mainContent = (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6">
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-brand-500/10 blur-2xl" />
        <div className="relative flex flex-col gap-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-500">Role overview</p><h2 className="mt-1 text-lg font-semibold text-[var(--text-hi)]">Hiring activity at a glance</h2></div>
            <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${status.chip}`}><Icon icon={status.icon} className="h-3.5 w-3.5" />{job.status}</div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard title="Applicants" value={candidates.length} icon="solar:users-group-two-rounded-broken" color="orange" compact />
            <StatCard title="In progress" value={activeCandidates} icon="solar:sort-horizontal-broken" color="blue" compact />
            <StatCard title="Interviews" value={stageCounts.interview} icon="solar:calendar-broken" color="blue" compact />
            <StatCard title="Offers" value={stageCounts.offer} icon="solar:letter-broken" color="amber" compact />
          </div>
        </div>
      </section>

      {/* ── Description ── */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/50 hover:shadow-2xl dark:shadow-black/20 p-5 sm:p-6 transition-shadow duration-200">
        <SectionHeader
          icon="solar:document-text-broken"
          iconBg="bg-brand-500/10"
          iconColor="text-brand-500"
          title="Description"
        />
        {job.description ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-hi)]">
            {job.description}
          </p>
        ) : (
          <p className="text-sm text-[var(--text-lo)]">No description yet.</p>
        )}
      </section>

      {/* ── Requirements ── */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/50 hover:shadow-2xl dark:shadow-black/20 p-5 sm:p-6 transition-shadow duration-200">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-[var(--text-hi)]">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/10"><Icon icon="solar:check-circle-broken" className="h-3.5 w-3.5 text-brand-500" /></span>
            Must-haves
          </div>
          {job.requirements.must_haves.length ? (
            <ul className="space-y-2">
              {job.requirements.must_haves.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm text-[var(--text-hi)]">
                  <Icon icon="solar:check-circle-broken" className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  {r}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--text-lo)]">None specified.</p>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/50 hover:shadow-2xl dark:shadow-black/20 p-5 sm:p-6 transition-shadow duration-200">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-[var(--text-hi)]">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/10"><Icon icon="solar:star-broken" className="h-3.5 w-3.5 text-brand-500" /></span>
            Nice-to-haves
          </div>
          {job.requirements.nice_to_haves.length ? (
            <ul className="space-y-2">
              {job.requirements.nice_to_haves.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm text-[var(--text-hi)]">
                  <Icon icon="solar:star-broken" className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                  {r}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--text-lo)]">None specified.</p>
          )}
        </section>
      </div>

      {/* ── AI Screening Rubric ── */}
      {job.scoring_rubric.length > 0 && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/50 hover:shadow-2xl dark:shadow-black/20 p-5 sm:p-6 transition-shadow duration-200">
          <div className="mb-5 flex items-start justify-between gap-3">
            <SectionHeader
              icon="solar:chart-square-broken"
              iconBg="bg-brand-500/10"
              iconColor="text-brand-500"
              title="AI Screening Rubric"
            />
            <span
              className={`mt-0.5 shrink-0 rounded-full px-2.5 py-1 font-mono text-[11px] font-bold ${
                rubricTotal === 100 ? "bg-green-500/10 text-green-500" : "bg-amber-500/10 text-amber-500"
              }`}
              title="Total weight of all criteria"
            >
              {rubricTotal}/100
            </span>
          </div>

          <div className="space-y-4">
            {job.scoring_rubric.map((r, i) => (
              <div key={i}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-[var(--text-hi)]">{r.criterion}</span>
                  <span className="font-mono text-xs font-bold text-blue-500">{r.weight}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${Math.min(Math.max(r.weight, 0), 100)}%` }}
                  />
                </div>
                {r.description && (
                  <p className="mt-1.5 text-xs text-[var(--text-lo)]">{r.description}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3"><SectionHeader icon="solar:users-group-two-rounded-broken" iconBg="bg-brand-500/10" iconColor="text-brand-500" title="Recent applicants" /><Link href={`/hire/candidates?job=${job.id}`} className="text-xs font-semibold text-brand-500 hover:text-brand-600">View pipeline</Link></div>
        {candidates.length ? <div className="divide-y divide-[var(--border)]">{candidates.slice(0, 5).map((candidate) => <Link key={candidate.id} href={`/hire/candidates/${candidate.id}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 transition-colors hover:text-brand-500"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-xs font-bold text-[var(--text-lo)]">{candidate.full_name.slice(0, 1)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[var(--text-hi)]">{candidate.full_name}</p><p className="text-[11px] text-[var(--text-lo)]">Applied {new Date(candidate.applied_at).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</p></div><span className="rounded-md bg-[var(--surface-2)] px-2 py-1 text-[10px] font-medium capitalize text-[var(--text-lo)]">{candidate.stage}</span>{candidate.ai_score !== null && <span className="font-mono text-xs font-bold text-green-600">{candidate.ai_score}</span>}<Icon icon="solar:arrow-right-broken" className="h-4 w-4 text-[var(--text-lo)]" /></Link>)}</div> : <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-lo)]">Applicants will appear here once this role is live.</div>}
      </section>
    </div>
  );

  const sidebar = (
    <>
      {/* ── Status ── */}
      <SidebarWidget title="Status" icon="solar:eye-broken" iconClass="bg-brand-500/10 text-brand-500">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
            <Icon icon={status.icon} className="h-5 w-5" />
          </div>
          <div>
            <p className={`text-sm font-semibold capitalize ${status.text}`}>{job.status}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-lo)]">{status.hint}</p>
          </div>
        </div>
      </SidebarWidget>

      {/* ── Pipeline ── */}
      <SidebarWidget
        title="Pipeline"
        icon="solar:users-group-two-rounded-broken"
        iconClass="bg-brand-500/10 text-brand-500"
      >
        <div className="flex items-end justify-between gap-3">
          <div><p className="font-mono text-3xl font-bold text-[var(--text-hi)]">{candidates.length}</p><p className="text-xs text-[var(--text-lo)]">total applicants</p></div>
          <Link
            href={`/hire/candidates?job=${job.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-500 transition-colors hover:bg-brand-500/10"
          >
            View all
            <Icon icon="solar:arrow-right-broken" className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="mt-4 space-y-2.5">{(["applied", "screened", "interview", "offer", "hired"] as const).map((stage) => <PipelineLine key={stage} label={stage} count={stageCounts[stage]} total={candidates.length} />)}</div>
      </SidebarWidget>

      {/* ── Meta ── */}
      <SidebarWidget title="Meta" icon="solar:calendar-broken" iconClass="bg-brand-500/10 text-brand-500">
        <dl className="space-y-2.5">
          <div className="flex items-center justify-between">
            <dt className="text-xs text-[var(--text-lo)]">Created</dt>
            <dd className="text-xs font-medium text-[var(--text-hi)]">
              {new Date(job.created_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-xs text-[var(--text-lo)]">Publishes</dt>
            <dd className="text-xs font-medium text-[var(--text-hi)]">
              {job.published_at
                ? new Date(job.published_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                : "Immediately"}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-xs text-[var(--text-lo)]">Closes</dt>
            <dd className="text-xs font-medium text-[var(--text-hi)]">
              {job.closes_at
                ? new Date(job.closes_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                : "No end date"}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-xs text-[var(--text-lo)]">Updated</dt>
            <dd className="text-xs font-medium text-[var(--text-hi)]">
              {new Date(job.updated_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </dd>
          </div>
        </dl>
      </SidebarWidget>
    </>
  );

  return (
    <>
      <SetPageHeader
        title={job.title}
        description={[job.department, job.location].filter(Boolean).join(" · ") || undefined}
        icon="solar:case-minimalistic-broken"
        actions={[
          ...(departmentResult.data ? [{ label: "Department", icon: "solar:buildings-broken", href: `/departments/${departmentResult.data.id}`, variant: "secondary" as const }] : []),
          { label: "Careers page", icon: "solar:global-broken", href: publicJobUrl(job.slug), variant: "secondary" as const },
          { label: "Edit", icon: "solar:pen-broken", href: `/hire/jobs/${job.id}/edit` },
          {
            label: "View candidates",
            icon: "solar:users-group-two-rounded-broken",
            href: `/hire/candidates?job=${job.id}`,
            variant: "primary",
          },
        ]}
      />
      <PageWithSidebar main={mainContent} sidebar={sidebar} />
    </>
  );
}

function PipelineLine({ label, count, total }: { label: string; count: number; total: number }) {
  const colors: Record<string, string> = { applied: "bg-slate-400", screened: "bg-blue-500", interview: "bg-cyan-500", offer: "bg-amber-500", hired: "bg-green-500" };
  return <div><div className="mb-1 flex items-center justify-between text-[11px]"><span className="capitalize text-[var(--text-lo)]">{label}</span><span className="font-mono font-bold text-[var(--text-hi)]">{count}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]"><div className={`h-full rounded-full ${colors[label]}`} style={{ width: `${total ? (count / total) * 100 : 0}%` }} /></div></div>;
}
