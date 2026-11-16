"use client";

import { useEffect, useRef, useState, type WheelEvent } from "react";
import { Icon } from "@iconify/react";
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
  readOnly?: boolean;
}

export function PipelineBoard({
  columns: initial,
  stages,
  readOnly = false,
}: Props) {
  const router = useRouter();
  const { requestStageEmail, stageEmailDialog } = useStageEmailPrompt();
  const [columns, setColumns] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const boardRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const update = () =>
      setOverflow({
        left: el.scrollLeft > 4,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
      });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [stages.length]);

  function scrollBoard(direction: 1 | -1) {
    boardRef.current?.scrollBy({ left: direction * 320, behavior: "smooth" });
  }

  function routeHorizontalScroll(event: WheelEvent<HTMLDivElement>) {
    const isHorizontalGesture =
      event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);
    const board = boardRef.current;
    if (!isHorizontalGesture || !board) return;

    const distance = event.deltaX || event.deltaY;
    const nextScrollLeft = Math.max(
      0,
      Math.min(board.scrollLeft + distance, board.scrollWidth - board.clientWidth),
    );
    if (nextScrollLeft === board.scrollLeft) return;

    event.preventDefault();
    board.scrollLeft = nextScrollLeft;
  }

  const activeCandidate = activeId
    ? Object.values(columns)
        .flat()
        .find((c) => c.id === activeId)
    : null;

  function onDragStart({ active }: DragStartEvent) {
    if (readOnly) return;
    setActiveId(active.id as string);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (readOnly) return;
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
        <div className="relative">
          {overflow.left && (
            <button
              type="button"
              onClick={() => scrollBoard(-1)}
              aria-label="Scroll pipeline left"
              className="absolute left-0 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-hi)] shadow-md hover:bg-[var(--surface-2)]"
            >
              <Icon icon="solar:alt-arrow-left-broken" className="h-4 w-4" />
            </button>
          )}
          {overflow.right && (
            <button
              type="button"
              onClick={() => scrollBoard(1)}
              aria-label="Scroll pipeline right"
              className="absolute right-0 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-hi)] shadow-md hover:bg-[var(--surface-2)]"
            >
              <Icon icon="solar:alt-arrow-right-broken" className="h-4 w-4" />
            </button>
          )}
          <div
            ref={boardRef}
            onWheel={routeHorizontalScroll}
            className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 md:mx-0 md:px-0"
          >
            {stages.map((stage) => (
              <PipelineColumn
                key={stage}
                stage={stage}
                label={STAGE_LABELS[stage]}
                candidates={columns[stage]}
                readOnly={readOnly}
              />
            ))}
          </div>
        </div>
        <DragOverlay>
          {!readOnly && activeCandidate && (
            <CandidateCard candidate={activeCandidate} isDragging />
          )}
        </DragOverlay>
      </DndContext>
    </>
  );
}
