"use client";

import { Icon } from "@iconify/react";
import { cn } from "@/shared/lib/cn";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

interface Props {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (n: number) => void;
}

export default function TablePagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: Props) {
  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[var(--border)] bg-[var(--surface-2)] px-5 py-4">
      {/* Left */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 text-xs text-[var(--text-lo)]">
        <span>
          Showing{" "}
          <span className="font-semibold text-[var(--text-hi)]">{from}</span> to{" "}
          <span className="font-semibold text-[var(--text-hi)]">{to}</span> of{" "}
          <span className="font-semibold text-[var(--text-hi)]">{total}</span>{" "}
          results
        </span>
        <div className="flex items-center gap-2">
          <span>Show:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
            }}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-hi)] outline-none focus:border-brand-500/60 cursor-pointer"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        <button
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-lo)] transition-all hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Icon icon="solar:alt-arrow-left-broken" className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Previous</span>
        </button>

        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          const p =
            totalPages <= 5
              ? i
              : Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={cn(
                "h-7 w-7 rounded-lg text-xs font-medium transition-all",
                page === p
                  ? "bg-brand-500 text-white shadow-sm"
                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-lo)] hover:bg-[var(--surface-2)] hover:text-[var(--text-hi)]",
              )}
            >
              {p + 1}
            </button>
          );
        })}

        <button
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange(page + 1)}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-lo)] transition-all hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <span className="hidden sm:inline">Next</span>
          <Icon icon="solar:alt-arrow-right-broken" className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
