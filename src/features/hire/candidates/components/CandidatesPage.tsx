import { getCandidates, type CandidateWithJob } from "../actions";
import CandidatesClientView from "./CandidatesClientView";
import PageHeader from "@/components/ui/PageHeader";
import { BulkScreenButton } from "./BulkScreenButton";

export default async function CandidatesPage({ jobId }: { jobId?: string }) {
  const candidates = await getCandidates(jobId);
  const unscreened = candidates.filter((c) => c.ai_score === null && (c.cv_text || c.cv_parsed));

  return (
    <div className="space-y-0">
      <PageHeader
        title="Candidates"
        description={`${candidates.length} candidate${candidates.length !== 1 ? "s" : ""}${jobId ? " for this role" : " across all roles"}`}
        icon="solar:users-group-two-rounded-broken"
      >
        {unscreened.length > 0 && (
          <BulkScreenButton candidateIds={unscreened.map((c) => c.id)} />
        )}
      </PageHeader>

      <CandidatesClientView
        candidates={candidates as unknown as CandidateWithJob[]}
        unscreenedIds={unscreened.map((c) => c.id)}
      />
    </div>
  );
}
