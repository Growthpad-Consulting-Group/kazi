"use client";

import { useDroppable } from "@dnd-kit/core";
import { CandidateCard } from "./CandidateCard";
import type { CandidateWithJob } from "@/features/hire/candidates/actions";
import type { CandidateStage } from "@/types/database";

interface Props {
  stage: CandidateStage;
  label: string;
  candidates: CandidateWithJob[];
}

export function PipelineColumn({ stage, label, candidates }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const style = columnStyle(stage);

  return (
    <div id={`pipeline-${stage}`} className="w-[19rem] shrink-0 scroll-mx-6">
      {/* Column header */}
      <div
        className={`mb-3 flex h-12 items-center justify-between rounded-2xl px-3.5 ${style.header}`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white/85 px-1.5 font-mono text-[11px] font-bold ${style.text}`}
          >
            {candidates.length}
          </span>
          <span className={`text-sm font-semibold ${style.text}`}>{label}</span>
        </div>
        <span className={`text-[11px] font-medium ${style.textMuted}`}>
          Stage
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`h-[calc(100dvh-18rem)] min-h-[30rem] max-h-[44rem] space-y-3 overflow-y-auto overscroll-contain rounded-2xl border p-3 pr-2 transition-all ${
          isOver
            ? "border-brand-500/40 bg-brand-500/8 ring-2 ring-brand-500/15"
            : "border-[var(--border)] bg-[var(--surface-2)]/40"
        }`}
      >
        {candidates.map((c) => (
          <CandidateCard key={c.id} candidate={c} />
        ))}
        {candidates.length === 0 && (
          <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-[var(--border)]">
            <p className="text-xs text-[var(--text-lo)]">
              Drop candidates here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function columnStyle(stage: CandidateStage): {
  header: string;
  text: string;
  textMuted: string;
} {
  const map: Record<
    CandidateStage,
    { header: string; text: string; textMuted: string }
  > = {
    applied: {
      header: "bg-slate-200 dark:bg-slate-700/70",
      text: "text-slate-700 dark:text-slate-100",
      textMuted: "text-slate-500 dark:text-slate-300",
    },
    screened: {
      header: "bg-blue-500/15",
      text: "text-blue-700 dark:text-blue-300",
      textMuted: "text-blue-600/70 dark:text-blue-300/70",
    },
    interview: {
      header: "bg-cyan-500/15",
      text: "text-cyan-700 dark:text-cyan-300",
      textMuted: "text-cyan-600/70 dark:text-cyan-300/70",
    },
    offer: {
      header: "bg-amber-500/15",
      text: "text-amber-700 dark:text-amber-300",
      textMuted: "text-amber-600/70 dark:text-amber-300/70",
    },
    hired: {
      header: "bg-green-500/15",
      text: "text-green-700 dark:text-green-300",
      textMuted: "text-green-600/70 dark:text-green-300/70",
    },
    rejected: {
      header: "bg-red-500/15",
      text: "text-red-700 dark:text-red-300",
      textMuted: "text-red-600/70 dark:text-red-300/70",
    },
  };
  return map[stage];
}
