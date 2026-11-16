"use client";

import { useTransition } from "react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { resetShortlistToAi, shortlistCandidate } from "../actions";

interface Props {
  candidateId: string;
  shortlisted: boolean;
  source: "ai" | "manual";
  aiScore: number | null;
  threshold: number;
}

export function ShortlistToggle({
  candidateId,
  shortlisted,
  source,
  aiScore,
  threshold,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const aiSuggests = aiScore !== null && aiScore >= threshold;

  function run(action: () => Promise<void>, success: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(success);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not update shortlist.",
        );
      }
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs leading-5 text-[var(--text-lo)]">
        {aiScore === null
          ? "Awaiting AI screening. You can still shortlist manually."
          : aiSuggests
            ? `AI suggests shortlisting (score ${aiScore} of ${threshold} or more).`
            : `AI does not suggest shortlisting (score ${aiScore}, below ${threshold}).`}
      </p>

      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          run(
            () => shortlistCandidate(candidateId, !shortlisted),
            shortlisted ? "Removed from shortlist" : "Added to shortlist",
          )
        }
        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${
          shortlisted
            ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
            : "bg-[var(--surface-2)] text-[var(--text-hi)] hover:bg-[var(--surface)]"
        }`}
      >
        <Icon
          icon={shortlisted ? "solar:star-bold" : "solar:star-broken"}
          className="h-4 w-4"
        />
        {shortlisted ? "Remove from shortlist" : "Add to shortlist"}
      </button>

      {source === "manual" && (
        <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-lo)]">
          <span>Set by a recruiter</span>
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              run(
                () => resetShortlistToAi(candidateId),
                "Shortlist reset to AI recommendation",
              )
            }
            className="font-semibold text-brand-600 hover:underline disabled:opacity-60"
          >
            Use AI recommendation
          </button>
        </div>
      )}
    </div>
  );
}
