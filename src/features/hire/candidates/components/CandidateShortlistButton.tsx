"use client";

import { useTransition } from "react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { shortlistCandidate } from "../actions";

/** Compact shortlist toggle for the candidates table. */
export default function CandidateShortlistButton({
  candidateId,
  shortlisted,
}: {
  candidateId: string;
  shortlisted: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      aria-pressed={shortlisted}
      aria-label={shortlisted ? "Remove from shortlist" : "Add to shortlist"}
      title={shortlisted ? "Remove from shortlist" : "Add to shortlist"}
      onClick={(event) => {
        event.stopPropagation();
        startTransition(async () => {
          try {
            await shortlistCandidate(candidateId, !shortlisted);
            toast.success(
              shortlisted ? "Removed from shortlist" : "Added to shortlist",
            );
            router.refresh();
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "Could not update shortlist.",
            );
          }
        });
      }}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors disabled:cursor-wait disabled:opacity-50 ${
        shortlisted
          ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
          : "bg-[var(--surface-2)] text-[var(--text-lo)] hover:bg-[var(--surface)] hover:text-[var(--text-hi)]"
      }`}
    >
      <Icon
        icon={shortlisted ? "solar:star-bold" : "solar:star-broken"}
        className="h-3.5 w-3.5"
      />
      {shortlisted ? "Shortlisted" : "Shortlist"}
    </button>
  );
}
