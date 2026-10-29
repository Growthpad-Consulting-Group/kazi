"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { PipelineColumn } from "./PipelineColumn";
import { CandidateCard } from "./CandidateCard";
import { updateCandidateStage } from "@/features/hire/candidates/actions";
import { useStageEmailPrompt } from "@/features/hire/candidates/components/StageEmailPrompt";
import type { CandidateWithJob } from "@/features/hire/candidates/actions";
import type { CandidateStage } from "@/types/database";
import { STAGE_LABELS } from "@/features/hire/candidates/types";

interface Props {
  columns: Record<CandidateStage, CandidateWithJob[]>;
  stages: CandidateStage[];
}

export function PipelineBoard({ columns: initial, stages }: Props) {
  const router = useRouter();
  const { requestStageEmail, stageEmailDialog } = useStageEmailPrompt();
  const [columns, setColumns] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const activeCandidate = activeId
    ? Object.values(columns)
        .flat()
        .find((c) => c.id === activeId)
    : null;

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;

    const toStage = over.id as CandidateStage;
    const candidateId = active.id as string;

    // Find current stage
    let fromStage: CandidateStage | null = null;
    for (const [stage, cards] of Object.entries(columns)) {
      if (cards.some((c) => c.id === candidateId)) {
        fromStage = stage as CandidateStage;
        break;
      }
    }
    if (!fromStage || fromStage === toStage) return;

    // Optimistic update
    setColumns((prev) => {
      const candidate = prev[fromStage!].find((c) => c.id === candidateId)!;
      return {
        ...prev,
        [fromStage!]: prev[fromStage!].filter((c) => c.id !== candidateId),
        [toStage]: [{ ...candidate, stage: toStage }, ...prev[toStage]],
      };
    });

    // Persist
    updateCandidateStage(candidateId, toStage)
      .then(() => {
        toast.success(`Moved to ${STAGE_LABELS[toStage]}`);
        requestStageEmail(candidateId, toStage);
        router.refresh();
      })
      .catch((error) => {
        setColumns(initial);
        toast.error(
          error instanceof Error ? error.message : "Could not move candidate",
        );
      });
  }

  return (
    <>
      {stageEmailDialog}
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 md:mx-0 md:px-0">
          {stages.map((stage) => (
            <PipelineColumn
              key={stage}
              stage={stage}
              label={STAGE_LABELS[stage]}
              candidates={columns[stage]}
            />
          ))}
        </div>
        <DragOverlay>
          {activeCandidate && (
            <CandidateCard candidate={activeCandidate} isDragging />
          )}
        </DragOverlay>
      </DndContext>
    </>
  );
}
