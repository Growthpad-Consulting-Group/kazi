"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { CandidateWithJob } from "@/features/hire/candidates/actions";

interface Props {
  candidate: CandidateWithJob;
  isDragging?: boolean;
}

export function CandidateCard({ candidate, isDragging }: Props) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: candidate.id,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`bg-white rounded-lg border border-slate-200 p-3 cursor-grab active:cursor-grabbing select-none transition-shadow ${
        isDragging ? "shadow-lg rotate-1 opacity-90" : "shadow-sm hover:shadow-md"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">{candidate.full_name}</p>
          <p className="text-xs text-slate-400 truncate mt-0.5">
            {candidate.jobs?.title ?? "—"}
          </p>
        </div>
        {candidate.ai_score !== null && (
          <span
            className={`flex-shrink-0 text-xs font-semibold rounded-full px-2 py-0.5 ${
              candidate.ai_score >= 65
                ? "bg-green-100 text-green-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {candidate.ai_score}
          </span>
        )}
      </div>

      {candidate.shortlisted && (
        <p className="mt-1.5 text-xs text-green-600 font-medium">✓ Shortlisted</p>
      )}

      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {new Date(candidate.applied_at).toLocaleDateString("en-KE", {
            day: "numeric",
            month: "short",
          })}
        </span>
        <Link
          href={`/hire/candidates/${candidate.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-blue-500 hover:text-blue-700 font-medium"
        >
          View
        </Link>
      </div>
    </div>
  );
}
