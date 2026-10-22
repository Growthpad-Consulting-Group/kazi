import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { InterviewKit } from "./InterviewKit";
import SetPageHeader from "@/components/ui/SetPageHeader";

export default async function InterviewPage({ candidateId }: { candidateId: string }) {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const { data, error } = await supabaseAdmin
    .from("candidates")
    .select("id, full_name, stage, jobs(id, title, scoring_rubric)")
    .eq("id", candidateId)
    .single();

  if (error || !data) notFound();

  const candidate = data as unknown as {
    id: string;
    full_name: string;
    stage: string;
    jobs: { id: string; title: string; scoring_rubric: { criterion: string; weight: number }[] } | null;
  };

  // Fetch existing scorecards for this interviewer
  const { data: scorecard } = await supabaseAdmin
    .from("interview_scorecards")
    .select("*")
    .eq("candidate_id", candidateId)
    .eq("interviewer_id", session.user.id)
    .maybeSingle();

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
      <section className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-6"><div className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-[#f05d23]/10 blur-3xl" /><div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-4"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#f05d23]/10 text-base font-bold text-[#f05d23]">{candidate.full_name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#f05d23]">Interview workspace</p><h1 className="mt-1 truncate text-xl font-semibold text-[var(--text-hi)]">{candidate.full_name}</h1><p className="mt-1 truncate text-sm text-[var(--text-lo)]">{candidate.jobs?.title ?? "Role not assigned"}</p></div></div><span className="w-fit rounded-lg bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold capitalize text-[var(--text-lo)]">{candidate.stage.replaceAll("_", " ")}</span></div></section>
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
