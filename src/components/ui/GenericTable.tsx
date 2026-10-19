  "use client";

import { useState, useMemo, ReactNode, useCallback } from "react";
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
  width?: string;
  render?: (row: T, value: unknown) => ReactNode;
}

export interface RowAction<T = Record<string, unknown>> {
  icon: string | ((row: T) => string);
  label: string | ((row: T) => string);
  onClick: (row: T) => void;
  variant?: "default" | "danger";
  show?: (row: T) => boolean;
}

export interface BulkAction<T = Record<string, unknown>> {
  icon: string;
  label: string;
  onClick: (rows: T[]) => void;
  variant?: "default" | "danger";
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
  bulkActions?: BulkAction<T>[];
  onRowClick?: (row: T) => void;
  pageSize?: number;
  rightContent?: ReactNode;
  className?: string;
  getRowId?: (row: T) => string;
  selectable?: boolean;
  showExport?: boolean;
  onExport?: (rows: T[]) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  stickyHeader?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getVal<T>(row: T, accessor: string): unknown {
  return accessor.split(".").reduce<unknown>((obj, key) => {
    if (obj != null && typeof obj === "object") return (obj as Record<string, unknown>)[key];
    return undefined;
  }, row);
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

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
  bulkActions = [],
  onRowClick,
  pageSize: defaultPageSize = 25,
  rightContent,
  className,
  getRowId,
  selectable = true,
  showExport = false,
  onExport,
  searchable = false,
  searchPlaceholder = "Search…",
  stickyHeader = false,
}: GenericTableProps<T>) {
  const [sortKey, setSortKey]     = useState<string | null>(null);
  const [sortDir, setSortDir]     = useState<"asc" | "desc">("asc");
  const [page, setPage]           = useState(0);
  const [pageSize, setPageSize]   = useState(defaultPageSize);
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [searchTerm, setSearch]   = useState("");

  const rowId = useCallback((row: T, i: number) =>
    getRowId ? getRowId(row) : String((row as Record<string, unknown>).id ?? i), [getRowId]);

  // Sort
  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = getVal(a, sortKey);
      const bv = getVal(b, sortKey);
      const cmp = String(av ?? "").localeCompare(String(bv ?? ""), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  // Search (client-side, only if searchable)
  const searched = useMemo(() => {
    if (!searchable || !searchTerm.trim()) return sorted;
    const q = searchTerm.toLowerCase();
    return sorted.filter((row) =>
      columns.some((col) => {
        const v = getVal(row, String(col.accessor));
        return String(v ?? "").toLowerCase().includes(q);
      })
    );
  }, [sorted, searchTerm, searchable, columns]);

  const total      = searched.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paginated  = searched.slice(page * pageSize, (page + 1) * pageSize);

  const toggleSort = (key: string) => {
    setPage(0);
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  // Selection
  const allPageIds    = paginated.map((r, i) => rowId(r, page * pageSize + i));
  const allPageSel    = allPageIds.length > 0 && allPageIds.every((id) => selected.has(id));
  const somePageSel   = allPageIds.some((id) => selected.has(id));

  const toggleRow = (id: string) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = () => {
    if (allPageSel) setSelected((s) => { const n = new Set(s); allPageIds.forEach((id) => n.delete(id)); return n; });
    else setSelected((s) => { const n = new Set(s); allPageIds.forEach((id) => n.add(id)); return n; });
  };

  const clearSelection = () => setSelected(new Set());

  const selectedRows = useMemo(
    () => data.filter((r, i) => selected.has(rowId(r, i))),
    [data, selected, rowId]
  );

  const visibleActions = (row: T) => actions.filter((a) => !a.show || a.show(row));
  const colSpan = columns.length + (selectable ? 1 : 0) + (actions.length > 0 ? 1 : 0);

  return (
    <div className={cn("rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-xl shadow-black/5 transition-all duration-300", className)}>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      {(title || searchable || rightContent || showExport) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-5 py-3">
          {/* Title */}
          {title && (
            <div className="flex items-center gap-2.5 shrink-0">
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

          {/* Search */}
          {searchable && (
            <div className="flex flex-1 min-w-[180px] items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-sm transition-all focus-within:border-[#f05d23]/50 focus-within:ring-2 focus-within:ring-[#f05d23]/20">
              <Icon icon="solar:magnifer-broken" className="h-4 w-4 shrink-0 text-[var(--text-lo)]" />
              <input
                value={searchTerm}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                placeholder={searchPlaceholder}
                className="flex-1 bg-transparent text-[var(--text-hi)] placeholder-[var(--text-lo)] outline-none"
              />
              {searchTerm && (
                <button onClick={() => setSearch("")} className="text-[var(--text-lo)] hover:text-[var(--text-hi)]">
                  <Icon icon="solar:close-circle-broken" className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {/* Right side */}
          <div className="flex items-center gap-2 ml-auto shrink-0">
            {rightContent}
            {showExport && (
              <button
                onClick={() => onExport?.(data)}
                title="Export"
                className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-lo)] hover:bg-[var(--surface-2)] hover:text-[var(--text-hi)] transition-all"
              >
                <Icon icon="solar:export-broken" className="h-4 w-4" />
                Export
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Bulk action bar ──────────────────────────────────────────────── */}
      {selectable && selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 border-b border-blue-200/60 dark:border-blue-800/30 bg-blue-50/60 dark:bg-blue-900/20 px-5 py-2.5">
          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
            {selected.size} row{selected.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2">
            {bulkActions.map((ba, i) => (
              <button
                key={i}
                onClick={() => { ba.onClick(selectedRows); clearSelection(); }}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                  ba.variant === "danger"
                    ? "bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/30"
                    : "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/30"
                )}
              >
                <Icon icon={ba.icon} className="h-3.5 w-3.5" />
                {ba.label}
              </button>
            ))}
            <button
              onClick={clearSelection}
              className="text-xs text-[var(--text-lo)] hover:text-[var(--text-hi)] transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={cn(
              "border-b border-[var(--border)] bg-[var(--surface-2)]/50",
              stickyHeader && "sticky top-0 z-10"
            )}>
              {selectable && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allPageSel}
                    ref={(el) => { if (el) el.indeterminate = somePageSel && !allPageSel; }}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-[var(--border)] accent-[#f05d23] cursor-pointer"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={String(col.accessor)}
                  style={col.width ? { width: col.width } : undefined}
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
                        className={cn("h-3.5 w-3.5", sortKey === String(col.accessor) ? "text-[#f05d23]" : "opacity-30")}
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
                  {selectable && <td className="px-4 py-3"><Skeleton className="h-4 w-4" /></td>}
                  {columns.map((col) => (
                    <td key={String(col.accessor)} className="px-4 py-3">
                      <Skeleton className="h-4 w-full max-w-[160px]" />
                    </td>
                  ))}
                  {actions.length > 0 && <td className="px-4 py-3"><Skeleton className="h-4 w-16 ml-auto" /></td>}
                </tr>
              ))
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="py-2">
                  <EmptyState icon={emptyIcon} title={emptyMessage} className="py-12" />
                </td>
              </tr>
            ) : (
              paginated.map((row, i) => {
                const id = rowId(row, page * pageSize + i);
                const isSel = selected.has(id);
                return (
                  <tr
                    key={id}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      "border-b border-[var(--border)] last:border-0 transition-colors",
                      isSel && "bg-[#f05d23]/5",
                      onRowClick ? "cursor-pointer hover:bg-[var(--surface-2)]" : "hover:bg-[var(--surface-2)]/50"
                    )}
                  >
                    {selectable && (
                      <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleRow(id)}
                          className="h-4 w-4 rounded border-[var(--border)] accent-[#f05d23] cursor-pointer"
                        />
                      </td>
                    )}
                    {columns.map((col) => {
                      const val = getVal(row, String(col.accessor));
                      return (
                        <td key={String(col.accessor)} className={cn("px-4 py-3 text-[var(--text-hi)]", col.className)}>
                          {col.render ? col.render(row, val) : String(val ?? "—")}
                        </td>
                      );
                    })}
                    {actions.length > 0 && (
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {visibleActions(row).map((action, ai) => {
                            const ic    = typeof action.icon  === "function" ? action.icon(row)  : action.icon;
                            const label = typeof action.label === "function" ? action.label(row) : action.label;
                            return (
                              <button
                                key={ai}
                                onClick={() => action.onClick(row)}
                                title={label}
                                className={cn(
                                  "rounded-lg p-1.5 transition-all active:scale-95",
                                  action.variant === "danger"
                                    ? "text-red-400 hover:bg-red-500/10"
                                    : "text-[var(--text-lo)] hover:bg-[var(--surface-2)] hover:text-[var(--text-hi)]"
                                )}
                              >
                                <Icon icon={ic} className="h-4 w-4" />
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer / Pagination ──────────────────────────────────────────── */}
      {!loading && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface-2)]/40 px-5 py-3">
          {/* Page size */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-lo)]">Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-hi)] outline-none focus:border-[#f05d23]/50 cursor-pointer"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          {/* Count + pages */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--text-lo)]">
              {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  disabled={page === 0}
                  onClick={() => setPage(0)}
                  className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--text-lo)] transition-all hover:bg-[var(--surface-2)] disabled:opacity-30"
                  title="First page"
                >
                  <Icon icon="solar:double-alt-arrow-left-broken" className="h-3.5 w-3.5" />
                </button>
                <button
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--text-lo)] transition-all hover:bg-[var(--surface-2)] disabled:opacity-30"
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
                          ? "bg-[#f05d23] text-white shadow-sm"
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
                  className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--text-lo)] transition-all hover:bg-[var(--surface-2)] disabled:opacity-30"
                >
                  <Icon icon="solar:alt-arrow-right-broken" className="h-3.5 w-3.5" />
                </button>
                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(totalPages - 1)}
                  className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--text-lo)] transition-all hover:bg-[var(--surface-2)] disabled:opacity-30"
                  title="Last page"
                >
                  <Icon icon="solar:double-alt-arrow-right-broken" className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
