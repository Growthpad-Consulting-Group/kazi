import { supabaseAdmin } from "@/lib/supabase";
import { getCandidates, type CandidateWithJob } from "../actions";
import CandidatesClientView from "./CandidatesClientView";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { getActiveHireWorkspace } from "@/lib/hire-workspace";
import HireWorkspaceSwitcher from "@/features/hire/components/HireWorkspaceSwitcher";

export default async function CandidatesPage({
  jobId,
  initialStage,
  initialAttention,
  initialRole,
  companySlug,
}: {
  jobId?: string;
  initialStage?: string;
  initialAttention?: string;
  initialRole?: string;
  companySlug?: string;
}) {
  const workspace = await getActiveHireWorkspace(companySlug);
  const [candidates, session, { data: interviewerData }] = await Promise.all([
    getCandidates(jobId, workspace.company.slug),
    Promise.resolve(workspace.session),
    supabaseAdmin
      .from("users")
      .select("id, name, job_title")
      .in("role", ["admin", "hr", "manager", "hiring_manager", "interviewer"])
      .eq("is_active", true)
      .order("name"),
  ]);
  const awaitingAi = candidates.filter(
    (c) => c.ai_score === null && (c.cv_url || c.cv_text || c.cv_parsed),
  );
  const interviewers = (interviewerData ?? []) as {
    id: string;
    name: string;
    job_title: string | null;
  }[];

  return (
    <>
      <SetPageHeader
        title="Candidates"
        description={`${candidates.length} candidate${candidates.length !== 1 ? "s" : ""}${jobId ? " for this role" : " across all roles"} in ${workspace.company.displayName} · AI-ranked matches first`}
        icon="solar:user-speak-broken"
        trailing={
          <HireWorkspaceSwitcher
            companies={workspace.access}
            activeSlug={workspace.company.slug}
          />
        }
        trailingIsFilter
      />
      <CandidatesClientView
        candidates={candidates as unknown as CandidateWithJob[]}
        unscreenedIds={awaitingAi.map((c) => c.id)}
        initialStage={initialStage}
        initialAttention={initialAttention}
        initialRole={initialRole}
        interviewers={interviewers}
        currentUserId={session?.user.id ?? ""}
      />
    </>
  );
}
