import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@iconify/react";
import { getJob } from "../actions";
import { supabaseAdmin } from "@/lib/supabase";
import type { JobStatus } from "@/types/database";
import SetPageHeader from "@/components/ui/SetPageHeader";
import PageWithSidebar from "@/components/ui/PageWithSidebar";
import SidebarWidget from "@/components/ui/SidebarWidget";

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

  const { count: candidateCount } = await supabaseAdmin
    .from("candidates")
    .select("id", { count: "exact", head: true })
    .eq("job_id", id);

  const status = STATUS_META[job.status] ?? STATUS_META.draft;
  const rubricTotal = job.scoring_rubric.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);

  const mainContent = (
    <div className="space-y-5">
      {/* ── Description ── */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/50 hover:shadow-2xl dark:shadow-black/20 p-5 sm:p-6 transition-shadow duration-200">
        <SectionHeader
          icon="solar:document-text-broken"
          iconBg="bg-violet-500/15"
          iconColor="text-violet-500"
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
          <div className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-[var(--text-hi)]">
            <Icon icon="solar:check-circle-broken" className="h-4 w-4 text-green-500" />
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
          <div className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-[var(--text-hi)]">
            <Icon icon="solar:star-broken" className="h-4 w-4 text-blue-400" />
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
              iconBg="bg-blue-500/15"
              iconColor="text-blue-500"
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
    </div>
  );

  const sidebar = (
    <>
      {/* ── Status ── */}
      <SidebarWidget title="Status" icon="solar:eye-broken" iconClass={status.chip}>
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${status.chip}`}>
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
        iconClass="bg-violet-500/15 text-violet-500"
      >
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-mono text-3xl font-bold text-[var(--text-hi)]">
              {candidateCount ?? 0}
            </p>
            <p className="text-xs text-[var(--text-lo)]">candidates applied</p>
          </div>
          <Link
            href={`/hire/candidates?job=${job.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#f05d23] transition-colors hover:bg-[#f05d23]/10"
          >
            View all
            <Icon icon="solar:arrow-right-broken" className="h-3.5 w-3.5" />
          </Link>
        </div>
      </SidebarWidget>

      {/* ── Meta ── */}
      <SidebarWidget title="Meta" icon="solar:calendar-broken">
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
