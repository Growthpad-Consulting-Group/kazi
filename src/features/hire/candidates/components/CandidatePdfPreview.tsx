"use client";

import { Document, Page, pdfjs } from "react-pdf";
import { Icon } from "@iconify/react";
import { useMemo, useState } from "react";

// Keep this next to the React-PDF components. The worker needs to be resolved
// by Next at build time, rather than fetched from a third-party CDN.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export function CandidatePdfPreview({
  url,
  className = "",
}: {
  url: string;
  className?: string;
}) {
  const [pageCount, setPageCount] = useState<number>();
  const [failed, setFailed] = useState(false);
  const options = useMemo(() => ({ withCredentials: true }), []);

  if (failed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-[var(--text-lo)]">
        <Icon icon="solar:danger-triangle-broken" className="h-6 w-6 text-amber-500" />
        <p>We could not preview this PDF.</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-brand-500 hover:text-brand-600"
        >
          Open the original document
        </a>
      </div>
    );
  }

  return (
    <div
      className={`h-full overflow-y-auto bg-slate-100 p-4 [scrollbar-gutter:stable] sm:p-6 dark:bg-slate-950 ${className}`}
    >
      <Document
        file={url}
        options={options}
        loading={
          <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-slate-500">
            <Icon icon="solar:refresh-circle-broken" className="h-5 w-5 animate-spin" />
            Rendering PDF…
          </div>
        }
        error={null}
        onLoadSuccess={({ numPages }) => setPageCount(numPages)}
        onLoadError={() => setFailed(true)}
      >
        <div className="mx-auto flex max-w-4xl flex-col gap-5">
          {Array.from({ length: pageCount ?? 0 }, (_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-sm bg-white shadow-[0_12px_30px_rgba(15,23,42,0.16)]"
            >
              <Page
                pageNumber={index + 1}
                width={920}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                className="[&>canvas]:!h-auto [&>canvas]:!w-full"
              />
            </div>
          ))}
        </div>
      </Document>
    </div>
  );
}
