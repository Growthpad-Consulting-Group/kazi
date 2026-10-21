import Link from "next/link";
import { Icon } from "@iconify/react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import SetPageHeader from "@/components/ui/SetPageHeader";
import StatCard from "@/components/ui/StatCard";
import { NewSurveyButton } from "./NewSurveyButton";
import type { Survey, SurveyStatus } from "@/types/database";

const STATUS: Record<SurveyStatus, { label: string; badge: string; icon: string; accent: string }> = {
  draft: { label: "Draft", badge: "bg-slate-500/10 text-slate-600", icon: "solar:pen-new-square-broken", accent: "bg-slate-400" },
  active: { label: "Live", badge: "bg-emerald-500/10 text-emerald-700", icon: "solar:play-circle-broken", accent: "bg-emerald-500" },
  closed: { label: "Closed", badge: "bg-slate-500/10 text-slate-600", icon: "solar:lock-keyhole-broken", accent: "bg-slate-400" },
};

function formattedDate(value: string) {
  return new Date(value).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

export default async function SurveysPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const isAdmin = hasRole(session.user.role, "hr");
  const { data } = await supabaseAdmin.from("surveys").select("*").order("created_at", { ascending: false });
  const surveys = (data ?? []) as unknown as Survey[];
  const active = surveys.filter((survey) => survey.status === "active");
  const drafts = surveys.filter((survey) => survey.status === "draft");
  const closed = surveys.filter((survey) => survey.status === "closed");
  const questions = surveys.reduce((total, survey) => total + survey.questions.length, 0);

  return (
    <>
      <SetPageHeader title="Surveys" description={active.length ? `${active.length} live survey${active.length === 1 ? "" : "s"} ready for your team` : "Listen closely, then act on what your team shares"} icon="solar:chat-round-dots-broken" trailing={isAdmin ? <NewSurveyButton userId={session.user.id} size="sm" /> : undefined} />

      <div className="mx-auto max-w-7xl space-y-5">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard title="Live surveys" value={active.length} icon="solar:play-circle-broken" color={active.length ? "green" : "slate"} compact subtitle={active.length ? "Collecting responses" : "Nothing running"} />
          <StatCard title="Drafts" value={drafts.length} icon="solar:pen-new-square-broken" color={drafts.length ? "amber" : "slate"} compact subtitle={drafts.length ? "Ready to prepare" : "No work in progress"} />
          <StatCard title="Closed" value={closed.length} icon="solar:lock-keyhole-broken" color="blue" compact subtitle="Available for reflection" />
          <StatCard title="Questions asked" value={questions} icon="solar:question-circle-broken" color="orange" compact subtitle="Across all surveys" />
        </section>

        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4 sm:px-6">
            <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#f05d23]/10 text-[#f05d23]"><Icon icon="solar:chat-round-dots-broken" className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold text-[var(--text-hi)]">All surveys</h2><p className="mt-0.5 text-xs text-[var(--text-lo)]">Create space for honest feedback and shared learning.</p></div></div>
            <span className="rounded-lg bg-[var(--surface-2)] px-2.5 py-1 font-mono text-[10px] font-semibold text-[var(--text-lo)]">{surveys.length} total</span>
          </div>

          {surveys.length ? (
            <div className="divide-y divide-[var(--border)]">
              {surveys.map((survey) => {
                const status = STATUS[survey.status];
                return (
                  <Link key={survey.id} href={`/pulse/surveys/${survey.id}`} className="group relative flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-[var(--surface-2)] sm:flex-row sm:items-center sm:px-6">
                    <span className={`absolute bottom-0 left-0 top-0 w-1 ${status.accent}`} />
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${status.badge}`}><Icon icon={status.icon} className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold text-[var(--text-hi)]">{survey.title}</h3>{survey.anonymous && <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-lo)]"><Icon icon="solar:incognito-broken" className="h-3 w-3" />Anonymous</span>}</div>{survey.description ? <p className="mt-1 line-clamp-1 text-xs text-[var(--text-lo)]">{survey.description}</p> : <p className="mt-1 text-xs text-[var(--text-lo)]">{survey.questions.length} question{survey.questions.length === 1 ? "" : "s"} · Created {formattedDate(survey.created_at)}</p>}</div>
                    <div className="flex shrink-0 items-center gap-3"><div className="hidden text-right sm:block"><p className="font-mono text-xs font-semibold text-[var(--text-hi)]">{survey.questions.length}</p><p className="text-[10px] text-[var(--text-lo)]">question{survey.questions.length === 1 ? "" : "s"}</p></div><span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold ${status.badge}`}><span className={`h-1.5 w-1.5 rounded-full ${status.accent}`} />{status.label}</span><Icon icon="solar:alt-arrow-right-broken" className="h-4 w-4 text-[var(--text-lo)] transition-transform group-hover:translate-x-0.5" /></div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center px-5 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f05d23]/10 text-[#f05d23]"><Icon icon="solar:chat-round-dots-broken" className="h-6 w-6" /></span><h2 className="mt-3 text-sm font-semibold text-[var(--text-hi)]">No surveys yet</h2><p className="mt-1 max-w-sm text-xs leading-relaxed text-[var(--text-lo)]">{isAdmin ? "Start with a short pulse to understand what your team needs most." : "When a survey is shared with you, it will appear here."}</p></div>
          )}
        </section>
      </div>
    </>
  );
}
