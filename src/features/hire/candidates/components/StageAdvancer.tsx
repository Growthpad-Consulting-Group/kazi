"use client";

import { useTransition } from "react";
import { updateCandidateStage } from "../actions";
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

  function advance() {
    if (isActive) return;
    startTransition(() => updateCandidateStage(candidateId, stage));
  }

  return (
    <button
      onClick={advance}
      disabled={isActive || isPending}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        isActive
          ? STAGE_COLORS[stage] + " cursor-default"
          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
      }`}
    >
      {STAGE_LABELS[stage]}
    </button>
  );
}
