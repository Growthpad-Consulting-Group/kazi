"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { SimpleModal } from "@/components/ui/SimpleModal";

export default function DeleteCandidateButton({
  candidateId,
  candidateName,
}: {
  candidateId: string;
  candidateName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    setDeleting(true);
    try {
      const response = await fetch("/api/hire/candidates/delete-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [candidateId] }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.error ?? "Could not delete candidate.");
      toast.success("Candidate deleted");
      router.push("/hire/candidates");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete candidate.",
      );
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-red-500 transition-colors hover:bg-red-500/10"
      >
        <Icon icon="solar:trash-bin-trash-broken" className="h-4 w-4" />
        Delete candidate
      </button>
      <SimpleModal
        open={open}
        onClose={() => {
          if (!deleting) setOpen(false);
        }}
        title="Delete candidate"
        icon="solar:trash-bin-trash-broken"
        maxWidth="max-w-md"
      >
        <p className="text-sm leading-6 text-[var(--text-lo)]">
          Delete{" "}
          <span className="font-semibold text-[var(--text-hi)]">
            {candidateName}
          </span>
          ? This removes their application, CV, notes and scorecards and cannot
          be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <button
            type="button"
            disabled={deleting}
            onClick={() => setOpen(false)}
            className="rounded-xl px-3.5 py-2 text-sm font-semibold text-[var(--text-lo)] hover:bg-[var(--surface-2)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={remove}
            className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Icon icon="solar:trash-bin-trash-broken" className="h-4 w-4" />
            {deleting ? "Deleting…" : "Delete candidate"}
          </button>
        </div>
      </SimpleModal>
    </>
  );
}
