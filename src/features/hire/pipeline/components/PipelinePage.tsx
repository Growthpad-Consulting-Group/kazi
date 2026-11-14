import { getCachedCandidates } from "@/lib/cache/queries";
import { getActiveHireWorkspace } from "@/lib/hire-workspace";
import HireWorkspaceSwitcher from "@/features/hire/components/HireWorkspaceSwitcher";
import { PipelineBoard } from "./PipelineBoard";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { PipelineHeaderMetrics } from "./PipelineHeaderMetrics";
import type { CandidateStage } from "@/types/database";
import type { CandidateWithJob } from "@/features/hire/candidates/actions";

const PIPELINE_STAGES: CandidateStage[] = [
  "applied",
  "screened",
  "interview",
  "offer",
  "hired",
];

export default async function PipelinePage({
  jobId,
  companySlug,
}: {
  jobId?: string;
  companySlug?: string;
}) {
  const workspace = await getActiveHireWorkspace(companySlug);
  const candidates = (await getCachedCandidates(
    jobId,
    true,
    [workspace.company.companyId],
  )) as unknown as CandidateWithJob[];

  // Group by stage
  const columns: Record<CandidateStage, CandidateWithJob[]> = {
    applied: [],
    screened: [],
    interview: [],
    offer: [],
    hired: [],
    rejected: [],
  };
  for (const c of candidates) {
    if (c.stage in columns) columns[c.stage].push(c);
  }
  const activeRoles = new Set(candidates.map((candidate) => candidate.job_id))
    .size;
  const awaitingReview = columns.applied.length;
  const inInterviews = columns.interview.length;
  const offersInPlay = columns.offer.length;

  return (
    <div>
      <SetPageHeader
        title="Hiring pipeline"
        description={`${candidates.length} candidate${candidates.length === 1 ? "" : "s"} across ${activeRoles} active role${activeRoles === 1 ? "" : "s"} in ${workspace.company.displayName}`}
        icon="solar:sort-horizontal-broken"
        trailing={
          <div className="flex items-center gap-2">
            <PipelineHeaderMetrics
              candidates={candidates.length}
              awaitingReview={awaitingReview}
              interviews={inInterviews}
              offers={offersInPlay}
            />
            <HireWorkspaceSwitcher
              companies={workspace.access}
              activeSlug={workspace.company.slug}
            />
          </div>
        }
        trailingIsFilter
      />
      <PipelineBoard columns={columns} stages={PIPELINE_STAGES} />
    </div>
  );
}
