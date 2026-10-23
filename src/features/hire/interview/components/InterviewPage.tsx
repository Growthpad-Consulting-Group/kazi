import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { InterviewKit } from "./InterviewKit";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { Icon } from "@iconify/react";
import StatCard from "@/components/ui/StatCard";

export default async function InterviewPage({ candidateId }: { candidateId: string }) {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const { data, error } = await supabaseAdmin
    .from("candidates")
    .select("id, full_name, email, location, cv_url, cv_text, cv_parsed, stage, jobs(id, title, department, scoring_rubric)")
    .eq("id", candidateId)
    .single();

  if (error || !data) notFound();

  const candidate = data as unknown as {
    id: string;
    full_name: string;
    email: string;
    location: string | null;
    cv_url: string | null;
    cv_text: string | null;
    cv_parsed: Record<string, unknown> | null;
    stage: string;
    jobs: { id: string; title: string; department: string | null; scoring_rubric: { criterion: string; weight: number }[] } | null;
  };

  // Fetch existing scorecards for this interviewer
  const { data: scorecard } = await supabaseAdmin
    .from("interview_scorecards")
    .select("*")
    .eq("candidate_id", candidateId)
    .eq("interviewer_id", session.user.id)
    .maybeSingle();

  const hasCv = Boolean(candidate.cv_url || candidate.cv_text || candidate.cv_parsed);
  const isSubmitted = Boolean(scorecard?.submitted_at);
  const initials = candidate.full_name.split(" ").map((part) => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <SetPageHeader
        title="Interview scorecard"
        description={`${candidate.full_name} · ${candidate.jobs?.title ?? "Role"}`}
        icon="solar:clipboard-check-broken"
        actions={[
          { label: "Candidate profile", icon: "solar:user-id-broken", href: `/hire/candidates/${candidate.id}`, variant: "secondary" },
        ]}
      />
      <section className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-14 h-44 w-44 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-orange-400 text-base font-bold text-white shadow-lg shadow-brand-500/20">{initials}</span>
            <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[.16em] text-brand-500">Candidate interview</p><h1 className="mt-1 truncate text-xl font-semibold text-[var(--text-hi)]">{candidate.full_name}</h1><p className="mt-1 truncate text-sm text-[var(--text-lo)]">{candidate.jobs?.title ?? "Role not assigned"}{candidate.jobs?.department ? ` · ${candidate.jobs.department}` : ""}</p><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--text-lo)]"><span className="inline-flex items-center gap-1"><Icon icon="solar:letter-broken" className="h-3.5 w-3.5" />{candidate.email}</span>{candidate.location && <span className="inline-flex items-center gap-1"><Icon icon="solar:map-point-broken" className="h-3.5 w-3.5" />{candidate.location}</span>}</div></div>
          </div>
          <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${isSubmitted ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>{isSubmitted ? "Scorecard submitted" : "Scorecard in progress"}</span>{candidate.cv_url ? <a href={candidate.cv_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold text-[var(--text-hi)] transition-colors hover:bg-brand-500/10 hover:text-brand-500"><Icon icon="solar:document-text-broken" className="h-4 w-4" />View CV</a> : hasCv ? <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold text-[var(--text-lo)]"><Icon icon="solar:document-text-broken" className="h-4 w-4" />CV available</span> : null}</div>
        </div>
      </section>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard title="Rubric criteria" value={candidate.jobs?.scoring_rubric.length ?? 0} icon="solar:clipboard-check-broken" color="orange" compact subtitle="Role evaluation areas" />
        <StatCard title="Pipeline stage" value={candidate.stage.replaceAll("_", " ")} icon="solar:sort-horizontal-broken" color="blue" compact subtitle="Current hiring step" />
        <StatCard title="CV status" value={hasCv ? "Ready" : "Missing"} icon="solar:document-text-broken" color={hasCv ? "blue" : "slate"} compact subtitle={hasCv ? "Available to review" : "No CV attached"} />
        <StatCard title="Your scorecard" value={isSubmitted ? "Complete" : "Draft"} icon={isSubmitted ? "solar:check-circle-broken" : "solar:pen-new-square-broken"} color={isSubmitted ? "green" : "amber"} compact subtitle={isSubmitted ? "Feedback submitted" : "Awaiting evaluation"} />
      </section>
      <InterviewKit
        candidateId={candidateId}
        candidateName={candidate.full_name}
        roleTitle={candidate.jobs?.title ?? "Role not assigned"}
        rubric={candidate.jobs?.scoring_rubric ?? []}
        existingScorecard={scorecard}
      />
    </div>
  );
}
