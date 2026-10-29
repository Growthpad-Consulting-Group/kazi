import { Suspense } from "react";
import CandidatesPage from "@/features/hire/candidates/components/CandidatesPage";
import PipelinePage from "@/features/hire/pipeline/components/PipelinePage";
import ReportingPage from "@/features/hire/reporting/components/ReportingPage";
import TabBar from "@/components/ui/TabBar";

const TABS = [
  {
    id: "list",
    label: "Candidates",
    icon: "solar:users-group-two-rounded-broken",
  },
  { id: "pipeline", label: "Pipeline", icon: "solar:sort-horizontal-broken" },
  { id: "reports", label: "Reports", icon: "solar:chart-broken" },
];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    job?: string;
    stage?: string;
    attention?: string;
    role?: string;
  }>;
}) {
  const { tab = "list", job, stage, attention, role } = await searchParams;

  return (
    <div>
      <Suspense>
        <TabBar tabs={TABS} />
      </Suspense>

      {tab === "pipeline" && <PipelinePage jobId={job} />}
      {tab === "reports" && <ReportingPage />}
      {(tab === "list" || !["pipeline", "reports"].includes(tab)) && (
        <CandidatesPage
          jobId={job}
          initialStage={stage}
          initialAttention={attention}
          initialRole={role}
        />
      )}
    </div>
  );
}
