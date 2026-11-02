"use client";

import { useRef, useState } from "react";
import { Icon } from "@iconify/react";
import dynamic from "next/dynamic";
import { SimpleModal } from "@/components/ui/SimpleModal";

const CandidatePdfPreview = dynamic(
  () =>
    import("./CandidatePdfPreview").then(
      (module) => module.CandidatePdfPreview,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-56 items-center justify-center gap-2 bg-[var(--surface-2)] text-sm text-[var(--text-lo)]">
        <Icon icon="solar:refresh-circle-broken" className="h-5 w-5 animate-spin" />
        Loading PDF viewer…
      </div>
    ),
  },
);

export function CandidateCvViewer({
  url,
  candidateId,
  candidateName,
  variant = "button",
}: {
  url: string;
  candidateId: string;
  candidateName?: string;
  variant?: "button" | "inline" | "compact";
}) {
  const [open, setOpen] = useState(false);
  const previewRef = useRef<HTMLIFrameElement>(null);
  const previewUrl = `/api/hire/candidates/${candidateId}/cv-preview`;
  const downloadUrl = `${previewUrl}?download=1`;
  const isPdf = /\.pdf(?:$|[?#])/i.test(url);

  if (variant === "inline") {
    return (
      <div className="mb-5 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--text-hi)]">
            <Icon
              icon="solar:document-text-broken"
              className="h-4 w-4 text-brand-500"
            />
            Original CV
          </span>
          <a
            href={downloadUrl}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-500 hover:text-brand-600"
          >
            Download CV
            <Icon icon="solar:arrow-right-up-broken" className="h-3.5 w-3.5" />
          </a>
        </div>
        {isPdf ? (
          <div className="h-[580px]">
            <CandidatePdfPreview url={previewUrl} />
          </div>
        ) : (
          <iframe
            title="Candidate CV document"
            src={previewUrl}
            className="h-[580px] w-full bg-white"
          />
        )}
        <p className="border-t border-[var(--border)] px-3.5 py-2 text-xs text-[var(--text-lo)]">
          Preview is rendered securely by Kazi. If it cannot load, download the
          original document.
        </p>
      </div>
    );
  }

  const trigger =
    variant === "compact" ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold text-[var(--text-hi)] transition-colors hover:bg-brand-500/10 hover:text-brand-500"
      >
        <Icon icon="solar:document-text-broken" className="h-4 w-4" />
        View CV
      </button>
    ) : (
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
    );

  return (
    <>
      {trigger}
      <SimpleModal
        open={open}
        onClose={() => setOpen(false)}
        title={candidateName ? `${candidateName} — CV` : "Candidate CV"}
        subtitle="Review the original document without leaving Kazi."
        icon="solar:document-text-broken"
        maxWidth="max-w-5xl"
        bodyClassName="h-[68vh] overflow-hidden overscroll-contain p-0"
      >
        {isPdf ? (
          <CandidatePdfPreview url={previewUrl} className="p-0 sm:p-0" />
        ) : (
          <iframe
            title="Candidate CV document"
            src={previewUrl}
            ref={previewRef}
            onLoad={() => open && previewRef.current?.focus()}
            tabIndex={0}
            className="h-full w-full bg-white"
            scrolling="yes"
          />
        )}
      </SimpleModal>
    </>
  );
}
