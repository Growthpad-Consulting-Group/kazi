"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { CandidateWithJob } from "@/features/hire/candidates/actions";
import { Icon } from "@iconify/react";

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
      className={`group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 select-none transition-all ${
        isDragging ? "rotate-1 cursor-grabbing opacity-90 shadow-xl" : "cursor-grab shadow-sm hover:-translate-y-0.5 hover:border-brand-500/30 hover:shadow-md"
      }`}
    >
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand-500 via-brand-500/35 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="inline-flex max-w-full truncate rounded-md bg-brand-500/8 px-2 py-0.5 text-[10px] font-medium text-brand-600">{candidate.jobs?.department ?? "Candidate"}</span>
          <p className="truncate text-sm font-semibold text-[var(--text-hi)]">{candidate.full_name}</p>
          <p className="mt-0.5 truncate text-xs text-[var(--text-lo)]">
            {candidate.jobs?.title ?? "—"}
          </p>
        </div>
        <Icon icon="solar:hamburger-menu-broken" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-lo)]/60" />
        {candidate.ai_score !== null && (
          <span
            className={`flex-shrink-0 text-xs font-semibold rounded-full px-2 py-0.5 ${
              candidate.ai_score >= 75
                ? "bg-green-500/10 text-green-600"
                : "bg-amber-500/10 text-amber-600"
            }`}
          >
            {candidate.ai_score}
          </span>
        )}
      </div>

      {candidate.shortlisted && <p className="mt-2 flex items-center gap-1 text-xs font-medium text-green-600"><Icon icon="solar:star-bold" className="h-3.5 w-3.5" /> Shortlisted</p>}

      <div className="mt-2 flex items-center justify-between">
        <span className="flex items-center gap-1 text-[11px] text-[var(--text-lo)]"><Icon icon="solar:calendar-minimalistic-broken" className="h-3.5 w-3.5" />
          {new Date(candidate.applied_at).toLocaleDateString("en-KE", {
            day: "numeric",
            month: "short",
          })}</span>
        <Link
          href={`/hire/candidates/${candidate.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-xs font-semibold text-brand-500 hover:text-brand-600"
        >
          View
        </Link>
      </div>
    </div>
  );
}
