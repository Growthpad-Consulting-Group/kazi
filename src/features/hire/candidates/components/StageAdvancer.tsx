"use client";

import { useTransition } from "react";
import { updateCandidateStage } from "../actions";
import { useStageEmailPrompt } from "./StageEmailPrompt";
import { STAGE_LABELS, STAGE_COLORS } from "../types";
import type { CandidateStage } from "../types";

interface Props {
  candidateId: string;
  stage: CandidateStage;
  current: CandidateStage;
}

export function StageAdvancer({ candidateId, stage, current }: Props) {
  const [isPending, startTransition] = useTransition();
  const isActive = current === stage;
  const { requestStageEmail, stageEmailDialog } = useStageEmailPrompt();

  function advance() {
    if (isActive) return;
    startTransition(async () => {
      await updateCandidateStage(candidateId, stage);
      requestStageEmail(candidateId, stage);
    });
  }

  return (
    <>
      {stageEmailDialog}
      <button
        onClick={advance}
        disabled={isActive || isPending}
        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
          isActive
            ? STAGE_COLORS[stage] + " cursor-default"
            : "bg-[var(--surface-2)] text-[var(--text-lo)] hover:bg-[var(--surface)]"
        }`}
      >
        {STAGE_LABELS[stage]}
      </button>
    </>
  );
}
