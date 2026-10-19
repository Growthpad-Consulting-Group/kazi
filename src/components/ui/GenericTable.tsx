"use client";

import { useState, useMemo, ReactNode } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/lib/cn";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./LoadingStates";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Column<T = Record<string, unknown>> {
  header: string;
  accessor: keyof T | string;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
  render?: (row: T, value: unknown) => ReactNode;
}

export interface RowAction<T = Record<string, unknown>> {
  icon: string | ((row: T) => string);
  label: string | ((row: T) => string);
  onClick: (row: T) => void;
  variant?: "default" | "danger";
  show?: (row: T) => boolean;
}

export interface GenericTableProps<T = Record<string, unknown>> {
  data?: T[];
  columns: Column<T>[];
  loading?: boolean;
  title?: string;
  icon?: string;
  emptyMessage?: string;
  emptyIcon?: string;
  actions?: RowAction<T>[];
  onRowClick?: (row: T) => void;
  pageSize?: number;
  rightContent?: ReactNode;
  className?: string;
  getRowId?: (row: T) => string;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function getVal<T>(row: T, accessor: string): unknown {
  return accessor.split(".").reduce<unknown>((obj, key) => {
    if (obj != null && typeof obj === "object") return (obj as Record<string, unknown>)[key];
    return undefined;
  }, row);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GenericTable<T extends Record<string, unknown>>({
  data = [],
  columns,
  loading = false,
  title,
  icon,
  emptyMessage = "No records found.",
  emptyIcon = "solar:inbox-broken",
  actions = [],
  onRowClick,
  pageSize = 25,
  rightContent,
  className,
}: GenericTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = getVal(a, sortKey);
      const bv = getVal(b, sortKey);
      const cmp = String(av ?? "").localeCompare(String(bv ?? ""), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paginated = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const visibleActions = (row: T) => actions.filter((a) => !a.show || a.show(row));

  return (
    <div className={cn("rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden", className)}>
      {/* Header row */}
      {(title || rightContent) && (
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4 gap-3">
          {title && (
            <div className="flex items-center gap-2.5">
              {icon && (
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#f05d23]/15">
                  <Icon icon={icon} className="h-3.5 w-3.5 text-[#f05d23]" />
                </div>
              )}
              <h2 className="text-sm font-semibold text-[var(--text-hi)]">{title}</h2>
              {!loading && (
                <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-lo)]">
                  {total}
                </span>
              )}
            </div>
          )}
          {rightContent && <div className="flex items-center gap-2 ml-auto">{rightContent}</div>}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {columns.map((col) => (
                <th
                  key={String(col.accessor)}
                  className={cn(
                    "px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--text-lo)]",
                    col.sortable && "cursor-pointer select-none hover:text-[var(--text-hi)] transition-colors",
                    col.headerClassName
                  )}
                  onClick={() => col.sortable && toggleSort(String(col.accessor))}
                >
                  <div className="flex items-center gap-1.5">
                    {col.header}
                    {col.sortable && (
                      <Icon
                        icon={
                          sortKey === String(col.accessor)
                            ? sortDir === "asc" ? "solar:alt-arrow-up-broken" : "solar:alt-arrow-down-broken"
                            : "solar:sort-broken"
                        }
                        className={cn("h-3.5 w-3.5", sortKey === String(col.accessor) ? "text-[#f05d23]" : "opacity-40")}
                      />
                    )}
                  </div>
                </th>
              ))}
              {actions.length > 0 && (
                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-[var(--text-lo)]">
                  Actions
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-[var(--border)] last:border-0">
                  {columns.map((col) => (
                    <td key={String(col.accessor)} className="px-4 py-3">
                      <Skeleton className="h-4 w-full max-w-[160px]" />
                    </td>
                  ))}
                  {actions.length > 0 && (
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
                  )}
                </tr>
              ))
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (actions.length > 0 ? 1 : 0)} className="py-2">
                  <EmptyState icon={emptyIcon} title={emptyMessage} className="py-12" />
                </td>
              </tr>
            ) : (
              paginated.map((row, i) => (
                <tr
                  key={i}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    "border-b border-[var(--border)] last:border-0 transition-colors",
                    onRowClick ? "cursor-pointer hover:bg-[var(--surface-2)]" : "hover:bg-[var(--surface-2)]/50"
                  )}
                >
                  {columns.map((col) => {
                    const val = getVal(row, String(col.accessor));
                    return (
                      <td key={String(col.accessor)} className={cn("px-4 py-3 text-[var(--text-hi)]", col.className)}>
                        {col.render ? col.render(row, val) : String(val ?? "—")}
                      </td>
                    );
                  })}
                  {actions.length > 0 && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {visibleActions(row).map((action, ai) => {
                          const icon = typeof action.icon === "function" ? action.icon(row) : action.icon;
                          const label = typeof action.label === "function" ? action.label(row) : action.label;
                          return (
                            <button
                              key={ai}
                              onClick={(e) => { e.stopPropagation(); action.onClick(row); }}
                              title={label}
                              className={cn(
                                "rounded-lg p-1.5 transition-all active:scale-95",
                                action.variant === "danger"
                                  ? "text-red-400 hover:bg-red-500/10"
                                  : "text-[var(--text-lo)] hover:bg-[var(--surface-2)] hover:text-[var(--text-hi)]"
                              )}
                            >
                              <Icon icon={icon} className="h-4 w-4" />
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && total > pageSize && (
        <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-3">
          <span className="text-xs text-[var(--text-lo)]">
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--text-lo)] transition-all hover:bg-[var(--surface-2)] hover:text-[var(--text-hi)] disabled:opacity-30"
            >
              <Icon icon="solar:alt-arrow-left-broken" className="h-3.5 w-3.5" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={cn(
                    "h-7 w-7 rounded-lg text-xs font-medium transition-all",
                    page === p
                      ? "bg-[#f05d23] text-white"
                      : "text-[var(--text-lo)] hover:bg-[var(--surface-2)] hover:text-[var(--text-hi)]"
                  )}
                >
                  {p + 1}
                </button>
              );
            })}
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--text-lo)] transition-all hover:bg-[var(--surface-2)] hover:text-[var(--text-hi)] disabled:opacity-30"
            >
              <Icon icon="solar:alt-arrow-right-broken" className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
