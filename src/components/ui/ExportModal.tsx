"use client";

import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: Record<string, unknown>[];
  columns: { header: string; accessor: string }[];
  title?: string;
}

export default function ExportModal({ isOpen, onClose, data, columns, title }: ExportModalProps) {
  const [selected, setSelected] = useState<Record<string, boolean>>(
    () => Object.fromEntries(columns.map((c) => [c.accessor, true]))
  );

  const activeColumns = useMemo(() => columns.filter((c) => selected[c.accessor]), [columns, selected]);

  const toggleAll = (on: boolean) =>
    setSelected(Object.fromEntries(columns.map((c) => [c.accessor, on])));

  const handleExportCSV = () => {
    const headers = activeColumns.map((c) => c.header);
    const rows = data.map((row) =>
      activeColumns.map((col) => {
        const val = col.accessor.split(".").reduce<unknown>(
          (acc, k) => acc != null && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined,
          row
        );
        const str = String(val ?? "");
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      })
    );
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title ?? "export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#f05d23]/10">
              <Icon icon="solar:export-broken" className="h-4 w-4 text-[#f05d23]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-hi)]">Export Data</h2>
              <p className="text-xs text-[var(--text-lo)]">{data.length} row{data.length !== 1 ? "s" : ""} · CSV</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-lo)] hover:bg-[var(--surface-2)] hover:text-[var(--text-hi)] transition-all"
          >
            <Icon icon="solar:close-circle-broken" className="h-4 w-4" />
          </button>
        </div>

        {/* Field selector */}
        <div className="px-6 py-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-lo)]">Select fields to export</span>
            <div className="flex gap-3">
              <button onClick={() => toggleAll(true)} className="text-xs text-[#f05d23] hover:underline">All</button>
              <button onClick={() => toggleAll(false)} className="text-xs text-[var(--text-lo)] hover:underline">None</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
            {columns.map((col) => (
              <label
                key={col.accessor}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 cursor-pointer hover:bg-[var(--surface-2)] transition-all"
              >
                <input
                  type="checkbox"
                  checked={!!selected[col.accessor]}
                  onChange={(e) => setSelected((s) => ({ ...s, [col.accessor]: e.target.checked }))}
                  className="accent-[#f05d23]"
                />
                <span className="text-xs text-[var(--text-hi)] truncate">{col.header}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--border)] px-6 py-4">
          <span className="text-xs text-[var(--text-lo)]">
            {activeColumns.length} of {columns.length} fields selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-xs font-medium text-[var(--text-lo)] hover:bg-[var(--surface-2)] transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleExportCSV}
              disabled={activeColumns.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-[#f05d23] px-4 py-2 text-xs font-medium text-white hover:bg-[#d94f1a] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Icon icon="solar:download-broken" className="h-3.5 w-3.5" />
              Download CSV
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
