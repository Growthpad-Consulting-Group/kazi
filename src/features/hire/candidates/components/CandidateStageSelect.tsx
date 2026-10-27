"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import toast from "react-hot-toast";
import { updateCandidateStage } from "../actions";
import { useStageEmailPrompt } from "./StageEmailPrompt";
import { STAGE_LABELS, type CandidateStage } from "../types";

const STAGES: CandidateStage[] = ["applied", "screened", "interview", "offer", "hired", "rejected"];

/** Compact inline stage control for recruiter triage in a table or pipeline board. */
export default function CandidateStageSelect({ candidateId, stage }: { candidateId: string; stage: CandidateStage }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { requestStageEmail, stageEmailDialog } = useStageEmailPrompt();

  return (
    <>
    {stageEmailDialog}
    <select
      aria-label="Move candidate stage"
      value={stage}
      disabled={isPending}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => {
        const nextStage = event.target.value as CandidateStage;
        startTransition(async () => {
          try {
            await updateCandidateStage(candidateId, nextStage);
            toast.success(`Moved to ${STAGE_LABELS[nextStage]}`);
            requestStageEmail(candidateId, nextStage);
            router.refresh();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not update candidate stage");
          }
        });
      }}
      className="max-w-28 cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-medium text-[var(--text-hi)] outline-none transition-colors hover:border-brand-500/40 disabled:cursor-wait disabled:opacity-50"
    >
      {STAGES.map((value) => <option key={value} value={value}>{STAGE_LABELS[value]}</option>)}
    </select>
    </>
  );
}
