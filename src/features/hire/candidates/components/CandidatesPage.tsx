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
  const candidates = await getCandidates(jobId);
  const awaitingAi = candidates.filter((c) => c.ai_score === null && (c.cv_text || c.cv_parsed));

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
      />
    </>
  );
}
