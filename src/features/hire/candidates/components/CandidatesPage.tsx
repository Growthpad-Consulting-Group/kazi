import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getCandidates, type CandidateWithJob } from "../actions";
import CandidatesClientView from "./CandidatesClientView";
import SetPageHeader from "@/components/ui/SetPageHeader";

export default async function CandidatesPage({
  jobId,
  initialStage,
  initialAttention,
  initialRole,
}: {
  jobId?: string;
  initialStage?: string;
  initialAttention?: string;
  initialRole?: string;
}) {
  const [candidates, session, { data: interviewerData }] = await Promise.all([
    getCandidates(jobId),
    getServerSession(authOptions),
    supabaseAdmin.from("users").select("id, name, job_title").in("role", ["admin", "hr", "manager", "hiring_manager", "interviewer"]).eq("is_active", true).order("name"),
  ]);
  const awaitingAi = candidates.filter((c) => c.ai_score === null && (c.cv_text || c.cv_parsed));
  const interviewers = (interviewerData ?? []) as { id: string; name: string; job_title: string | null }[];

  return (
    <>
      <SetPageHeader
        title="Candidates"
        description={`${candidates.length} candidate${candidates.length !== 1 ? "s" : ""}${jobId ? " for this role" : " across all roles"} · AI-ranked matches first`}
        icon="solar:user-speak-broken"
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
