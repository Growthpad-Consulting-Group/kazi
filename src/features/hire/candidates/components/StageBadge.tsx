import type { CandidateStage } from "../types";
import { STAGE_LABELS, STAGE_COLORS } from "../types";

export function StageBadge({ stage }: { stage: CandidateStage }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STAGE_COLORS[stage]}`}
    >
      {STAGE_LABELS[stage]}
    </span>
  );
}
