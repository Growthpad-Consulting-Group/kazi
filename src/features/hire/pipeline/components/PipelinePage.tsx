import { getCachedCandidates } from "@/lib/cache/queries";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PipelineBoard } from "./PipelineBoard";
import type { CandidateStage } from "@/types/database";
import type { CandidateWithJob } from "@/features/hire/candidates/actions";

const PIPELINE_STAGES: CandidateStage[] = ["applied", "screened", "interview", "offer", "hired"];

export default async function PipelinePage({ jobId }: { jobId?: string }) {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const candidates = (await getCachedCandidates(jobId, true)) as unknown as CandidateWithJob[];

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pipeline</h1>
          <p className="mt-1 text-sm text-slate-500">
            {candidates.length} active candidate{candidates.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
      <PipelineBoard columns={columns} stages={PIPELINE_STAGES} />
    </div>
  );
}
