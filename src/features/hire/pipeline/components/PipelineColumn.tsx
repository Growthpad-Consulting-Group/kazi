"use client";

import { useDroppable } from "@dnd-kit/core";
import { CandidateCard } from "./CandidateCard";
import type { CandidateWithJob } from "@/features/hire/candidates/actions";
import type { CandidateStage } from "@/types/database";
import { STAGE_COLORS } from "@/features/hire/candidates/types";

interface Props {
  stage: CandidateStage;
  label: string;
  candidates: CandidateWithJob[];
}

export function PipelineColumn({ stage, label, candidates }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div className="flex-shrink-0 w-64">
      {/* Column header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${dotColor(stage)}`} />
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
            {label}
          </span>
        </div>
        <span className="text-xs text-slate-400 font-medium">{candidates.length}</span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`min-h-[60vh] rounded-xl p-2 space-y-2 transition-colors ${
          isOver ? "bg-blue-50 ring-2 ring-blue-200" : "bg-slate-100"
        }`}
      >
        {candidates.map((c) => (
          <CandidateCard key={c.id} candidate={c} />
        ))}
        {candidates.length === 0 && (
          <div className="flex items-center justify-center h-20">
            <p className="text-xs text-slate-400">Drop here</p>
          </div>
        )}
      </div>
    </div>
  );
}

function dotColor(stage: CandidateStage): string {
  const map: Record<CandidateStage, string> = {
    applied: "bg-slate-400",
    screened: "bg-blue-400",
    interview: "bg-violet-500",
    offer: "bg-amber-400",
    hired: "bg-green-500",
    rejected: "bg-red-400",
  };
  return map[stage];
}
