"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import { SimpleModal } from "@/components/ui/SimpleModal";

export function CandidateCvViewer({
  url,
  candidateId,
  variant = "button",
}: {
  url: string;
  candidateId: string;
  variant?: "button" | "inline";
}) {
  const [open, setOpen] = useState(false);
  const previewUrl = `/api/hire/candidates/${candidateId}/cv-preview`;

  if (variant === "inline") {
    return (
      <div className="mb-5 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--text-hi)]">
            <Icon icon="solar:document-text-broken" className="h-4 w-4 text-brand-500" />
            Original CV
          </span>
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-500 hover:text-brand-600">
            Open original
            <Icon icon="solar:arrow-right-up-broken" className="h-3.5 w-3.5" />
          </a>
        </div>
        <iframe
          title="Candidate CV document"
          src={previewUrl}
          className="h-[580px] w-full bg-white"
        />
        <p className="border-t border-[var(--border)] px-3.5 py-2 text-xs text-[var(--text-lo)]">Preview is rendered securely by Kazi. If it cannot load, open the original document.</p>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 flex w-full items-center justify-between rounded-xl bg-brand-500 px-3.5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
      >
        <span className="inline-flex items-center gap-2">
          <Icon icon="solar:document-text-broken" className="h-4 w-4" />
          View candidate CV
        </span>
        <Icon icon="solar:eye-broken" className="h-4 w-4" />
      </button>
      <SimpleModal
        open={open}
        onClose={() => setOpen(false)}
        title="Candidate CV"
        subtitle="Review the original document without leaving Kazi."
        icon="solar:document-text-broken"
        maxWidth="max-w-5xl"
      >
        <iframe title="Candidate CV document" src={previewUrl} className="h-[52vh] w-full rounded-xl border border-[var(--border)] bg-white" />
      </SimpleModal>
    </>
  );
}
