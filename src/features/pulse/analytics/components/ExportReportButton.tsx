"use client";

import { useState, useRef, useEffect } from "react";
import { Icon } from "@iconify/react";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ExportReportButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleExport(format: "json" | "csv") {
    setLoading(true);
    setError(null);
    setOpen(false);
    try {
      const res = await fetch(`/api/pulse/reports/culture-export?format=${format}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Error ${res.status}`);
      }
      const date = new Date().toISOString().slice(0, 10);
      if (format === "json") {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        download(blob, `culture-report-${date}.json`);
      } else {
        const text = await res.text();
        const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
        download(blob, `culture-report-${date}.csv`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1" ref={containerRef}>
      <div className="relative inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-visible">
        {/* Primary button */}
        <button
          onClick={() => handleExport("json")}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-[var(--text-hi)] transition-colors hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-60 rounded-l-xl"
        >
          <Icon
            icon={loading ? "solar:refresh-broken" : "solar:export-broken"}
            className={`h-4 w-4 text-brand-500 ${loading ? "animate-spin" : ""}`}
          />
          {loading ? "Exporting…" : "Export report"}
        </button>

        {/* Divider */}
        <span className="w-px self-stretch bg-[var(--border)]" aria-hidden="true" />

        {/* Caret toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          disabled={loading}
          aria-label="More export options"
          aria-expanded={open}
          className="inline-flex items-center px-2.5 py-2 text-sm font-semibold text-[var(--text-hi)] transition-colors hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-60 rounded-r-xl"
        >
          <Icon
            icon="solar:alt-arrow-down-broken"
            className={`h-3.5 w-3.5 text-[var(--text-lo)] transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          />
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute right-0 top-full z-10 mt-1.5 w-44 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/50 dark:shadow-black/20 overflow-hidden">
            <button
              onClick={() => handleExport("json")}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-hi)] transition-colors hover:bg-[var(--surface-2)]"
            >
              <Icon icon="solar:file-text-broken" className="h-4 w-4 text-brand-500 shrink-0" />
              Download JSON
            </button>
            <button
              onClick={() => handleExport("csv")}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-hi)] transition-colors hover:bg-[var(--surface-2)]"
            >
              <Icon icon="solar:file-linear-broken" className="h-4 w-4 text-brand-500 shrink-0" />
              Download CSV
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
