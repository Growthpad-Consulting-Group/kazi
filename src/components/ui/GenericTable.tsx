"use client";

import { useState, useMemo, useCallback, useEffect, ReactNode } from "react";
import { Icon } from "@iconify/react";
import { parseISO, isWithinInterval } from "date-fns";
import { cn } from "@/shared/lib/cn";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./LoadingStates";
import TableHeader from "./table/TableHeader";
import TableRow from "./table/TableRow";
import TablePagination from "./table/TablePagination";
import DateRangePicker, { type DateRangeValue } from "./DateRangePicker";
import ExportModal from "./export/ExportModal";
import TooltipIconButton from "./TooltipIconButton";
import toast from "react-hot-toast";
import ColumnVisibilityMenu from "./table/ColumnVisibilityMenu";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Column<T = Record<string, unknown>> {
  header: string;
  accessor: keyof T | string;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
  width?: string;
  render?: (row: T, value: unknown) => ReactNode;
  /** Always shown; left out of the Columns menu. */
  locked?: boolean;
}

export type RowActionVariant = "default" | "info" | "warning" | "danger" | "success";

export interface RowAction<T = Record<string, unknown>> {
  icon: string | ((row: T) => string);
  label: string | ((row: T) => string);
  onClick: (row: T) => void;
  /** Colour scheme for the button. Ignored when `className` is provided. */
  variant?: RowActionVariant;
  /** Full Tailwind class override for the button, e.g. bflowpos-style per-action colours. */
  className?: string | ((row: T) => string);
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
  unifiedSearchFilter?: ReactNode;
  onAddNew?: () => void;
  addNewLabel?: string;
  fullPageHeight?: boolean;
  tableMaxHeight?: string | number;
  onImport?: () => void;
  enableDateFilter?: boolean;
  enableRefresh?: boolean;
  onRefresh?: () => void;
  allowedDateRanges?: string[];
  /** Remembers hidden columns in this browser under this key. */
  storageKey?: string;
  /** Shows the Columns menu for hiding columns. Defaults to on. */
  enableColumnToggle?: boolean;
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
  bulkActions = [],
  onRowClick,
  pageSize: defaultPageSize = 25,
  rightContent,
  className,
  getRowId,
  selectable = true,
  showExport = true,
  onExport,
  searchable = false,
  searchPlaceholder = "Search…",
  stickyHeader,
  unifiedSearchFilter,
  onAddNew,
  addNewLabel = "Add New",
  fullPageHeight = true,
  tableMaxHeight: propTableMaxHeight,
  onImport,
  enableDateFilter = true,
  enableRefresh = true,
  onRefresh,
  allowedDateRanges,
  storageKey,
  enableColumnToggle = true,
}: GenericTableProps<T>) {
  const tableMaxHeight = useMemo(() => {
    if (propTableMaxHeight) return propTableMaxHeight;
    if (fullPageHeight) return "calc(100vh - var(--header-height) - 200px)";
    return undefined;
  }, [propTableMaxHeight, fullPageHeight]);

  const derivedStickyHeader = stickyHeader ?? !!(tableMaxHeight);
  const [dateRange, setDateRange] = useState<DateRangeValue>({ startDate: null, endDate: null, label: 'All Time' });
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [columnOrder, setColumnOrder] = useState<string[]>([]);

  // Read the saved choice after mount so server and client render the same markup.
  useEffect(() => {
    if (!storageKey) return;
    const frame = window.requestAnimationFrame(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(`${storageKey}:hidden-columns`) ?? "[]") as string[];
        setHiddenColumns(new Set(saved));
      } catch {
        setHiddenColumns(new Set());
      }
      try {
        setColumnOrder(JSON.parse(localStorage.getItem(`${storageKey}:column-order`) ?? "[]") as string[]);
      } catch {
        setColumnOrder([]);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [storageKey]);

  const toggleColumn = useCallback((id: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (storageKey) {
        try { localStorage.setItem(`${storageKey}:hidden-columns`, JSON.stringify([...next])); } catch { /* storage unavailable */ }
      }
      return next;
    });
  }, [storageKey]);

  const reorderColumns = useCallback((ids: string[]) => {
    setColumnOrder(ids);
    if (storageKey) {
      try { localStorage.setItem(`${storageKey}:column-order`, JSON.stringify(ids)); } catch { /* storage unavailable */ }
    }
  }, [storageKey]);

  // Saved order first, then any columns the saved order doesn't mention, in their original order.
  const orderedColumns = useMemo(() => {
    const ids = columns.map((col) => String(col.accessor));
    const known = columnOrder.filter((id) => ids.includes(id));
    const full = [...known, ...ids.filter((id) => !known.includes(id))];
    return full.map((id) => columns.find((col) => String(col.accessor) === id)!);
  }, [columns, columnOrder]);

  const visibleColumns = useMemo(
    () => orderedColumns.filter((col) => col.locked || !hiddenColumns.has(String(col.accessor))),
    [orderedColumns, hiddenColumns],
  );
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportRows, setExportRows] = useState<T[] | null>(null);
  const [filterKey, setFilterKey] = useState(0);
  const [sortKey, setSortKey]   = useState<string | null>(null);
  const [sortDir, setSortDir]   = useState<"asc" | "desc">("asc");
  const [page, setPage]         = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchTerm, setSearch] = useState("");
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  // Every selectable table has a safe, universal bulk action: export the
  // selected rows. Feature-specific actions can be supplied through props.
  const canSelect = selectable && (bulkActions.length > 0 || showExport);

  const rowId = useCallback((row: T, i: number) =>
    getRowId ? getRowId(row) : String((row as Record<string, unknown>).id ?? i), [getRowId]);

  const toggleSort = (key: string) => {
    setPage(0);
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const getVal = (o: T) => sortKey.split(".").reduce<unknown>((acc, k) => {
        if (acc != null && typeof acc === "object") return (acc as Record<string, unknown>)[k];
        return undefined;
      }, o);
      const cmp = String(getVal(a) ?? "").localeCompare(String(getVal(b) ?? ""), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const dateFiltered = useMemo(() => {
    if (!enableDateFilter) return sorted;
    const { startDate, endDate } = dateRange;
    if (!startDate || !endDate) return sorted;
    const dateFields = ['created_at', 'updated_at', 'applied_at', 'published_at', 'date', 'timestamp'];
    return sorted.filter((row) => {
      let dateValue: unknown = null;
      for (const field of dateFields) {
        if ((row as Record<string, unknown>)[field]) { dateValue = (row as Record<string, unknown>)[field]; break; }
      }
      if (!dateValue) return false;
      try {
        let parsedDate: Date;
        if (typeof dateValue === 'string') {
          parsedDate = parseISO(dateValue);
          if (isNaN(parsedDate.getTime())) parsedDate = new Date(dateValue);
        } else if (typeof dateValue === 'number') {
          parsedDate = new Date(dateValue);
        } else if (dateValue instanceof Date) {
          parsedDate = dateValue;
        } else {
          return false;
        }
        if (isNaN(parsedDate.getTime())) return false;
        const s = new Date(startDate); s.setHours(0, 0, 0, 0);
        const e = new Date(endDate); e.setHours(23, 59, 59, 999);
        return isWithinInterval(parsedDate, { start: s, end: e });
      } catch { return false; }
    });
  }, [sorted, dateRange, enableDateFilter]);

  const searched = useMemo(() => {
    if (!searchable || !searchTerm.trim()) return dateFiltered;
    const q = searchTerm.toLowerCase();
    return dateFiltered.filter((row) =>
      columns.some((col) => {
        const path = String(col.accessor);
        const val = path.split(".").reduce<unknown>((acc, k) =>
          acc != null && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined, row);
        return String(val ?? "").toLowerCase().includes(q);
      })
    );
  }, [dateFiltered, searchTerm, searchable, columns]);

  const total      = searched.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paginated  = searched.slice(page * pageSize, (page + 1) * pageSize);

  // Selection
  const allPageIds  = paginated.map((r, i) => rowId(r, page * pageSize + i));
  const allPageSel  = allPageIds.length > 0 && allPageIds.every((id) => selected.has(id));
  const somePageSel = allPageIds.some((id) => selected.has(id));

  const toggleRow = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const toggleAll = () => {
    if (allPageSel) setSelected((s) => { const n = new Set(s); allPageIds.forEach((id) => n.delete(id)); return n; });
    else setSelected((s) => { const n = new Set(s); allPageIds.forEach((id) => n.add(id)); return n; });
  };

  const clearSelection = () => setSelected(new Set());

  const selectedRows = useMemo(
    () => data.filter((r, i) => selected.has(rowId(r, i))),
    [data, selected, rowId]
  );

  const handleExport = () => {
    if (onExport) { onExport(searched); return; }
    setExportRows(null);
    setShowExportModal(true);
  };

  const resolvedBulkActions: BulkAction<T>[] = [
    ...bulkActions,
    ...(showExport ? [{
      icon: "solar:export-broken",
      label: "Export selected",
      onClick: (rows: T[]) => {
        if (onExport) {
          onExport(rows);
        } else {
          setExportRows(rows);
          setShowExportModal(true);
        }
      },
    }] : []),
  ];

  const handleRefresh = () => {
    setSortKey(null); setSortDir("asc"); setPage(0); setSearch("");
    setDateRange({ startDate: null, endDate: null, label: "All Time" });
    setSelected(new Set());
    setFilterKey((k) => k + 1);
    if (onRefresh) onRefresh();
    toast.success("Table refreshed");
  };

  const showToolbar = !!(title || searchable || unifiedSearchFilter || rightContent || showExport || onAddNew || onImport || enableDateFilter || enableRefresh);

  return (
    <div className={cn(
      "w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-xl shadow-slate-200/50 hover:shadow-2xl dark:shadow-black/20 transition-all duration-200",
      className
    )}>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      {showToolbar && (
        <div className="border-b border-[var(--border)] bg-[var(--surface-2)]/40 px-5 py-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
            {title && (
              <div className="flex items-center gap-2.5 shrink-0">
                {icon && (
                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/15">
                    <Icon icon={icon} className="h-3.5 w-3.5 text-brand-500" />
                  </div>
                )}
                <h2 className="text-base font-semibold text-[var(--text-hi)]">{title}</h2>
                {!loading && (
                  <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-lo)]">
                    {total}
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-1 min-w-0 items-center justify-between gap-3">
              {/* LEFT: filter */}
              <div className="flex flex-1 min-w-0 items-center gap-2">
                {enableDateFilter && (
                  <DateRangePicker
                    value={dateRange}
                    onChange={setDateRange}
                    allowedRanges={allowedDateRanges}
                  />
                )}
                {unifiedSearchFilter && (
                  <div key={filterKey} className="flex-1 min-w-0">{unifiedSearchFilter}</div>
                )}
                {!unifiedSearchFilter && searchable && (
                  <div className="flex flex-1 min-w-[180px] items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm transition-all focus-within:border-brand-500/50 focus-within:ring-2 focus-within:ring-brand-500/20">
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
              </div>

              {/* RIGHT: actions */}
              <div className="flex items-center gap-1 shrink-0">
                {rightContent}
                {enableColumnToggle && (
                  <ColumnVisibilityMenu
                    columns={orderedColumns}
                    hidden={hiddenColumns}
                    onToggle={toggleColumn}
                    onReorder={reorderColumns}
                  />
                )}
                {enableRefresh && (
                  <TooltipIconButton
                    icon="solar:refresh-broken"
                    label="Refresh"
                    onClick={handleRefresh}
                    className="border border-[var(--border)] bg-[var(--surface)] text-[var(--text-lo)] hover:bg-[var(--surface-2)] hover:text-[var(--text-hi)] transition-all"
                    iconClassName="h-4 w-4"
                    position="bottom"
                  />
                )}
                {showExport && (
                  <TooltipIconButton
                    label="Export"
                    onClick={handleExport}
                    className="border border-[var(--border)] bg-[var(--surface)] text-[var(--text-lo)] hover:bg-[var(--surface-2)] hover:text-[var(--text-hi)] transition-all"
                    iconClassName="h-4 w-4"
                    position="bottom"
                  >
                    <div className="flex items-center gap-1.5 px-1 text-xs font-medium">
                      <Icon icon="solar:export-broken" className="h-4 w-4" />
                      Export
                    </div>
                  </TooltipIconButton>
                )}
                {onImport && (
                  <TooltipIconButton
                    label="Import"
                    onClick={onImport}
                    className="border border-[var(--border)] bg-[var(--surface)] text-[var(--text-lo)] hover:bg-[var(--surface-2)] hover:text-[var(--text-hi)] transition-all"
                    iconClassName="h-4 w-4"
                    position="bottom"
                  >
                    <div className="flex items-center gap-1.5 px-1 text-xs font-medium">
                      <Icon icon="solar:import-broken" className="h-4 w-4" />
                      Import
                    </div>
                  </TooltipIconButton>
                )}
                {onAddNew && (
                  <TooltipIconButton
                    label={addNewLabel}
                    onClick={onAddNew}
                    className="bg-brand-500 text-white hover:bg-[#d94f1a] transition-all shadow-sm"
                    iconClassName="h-4 w-4"
                    position="bottom"
                  >
                    <div className="flex items-center gap-1.5 px-1 text-xs font-medium">
                      <Icon icon="solar:add-circle-broken" className="h-4 w-4" />
                      {addNewLabel}
                    </div>
                  </TooltipIconButton>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk bar ─────────────────────────────────────────────────────── */}
      {canSelect && selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 border-b border-blue-200/60 dark:border-blue-800/30 bg-blue-50/60 dark:bg-blue-900/20 px-5 py-2.5">
          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
            {selected.size} row{selected.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2">
            {resolvedBulkActions.map((ba, i) => (
              <button
                key={i}
                onClick={() => { ba.onClick(selectedRows); clearSelection(); }}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                  ba.variant === "danger"
                    ? "bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-200"
                    : "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-200"
                )}
              >
                <Icon icon={ba.icon} className="h-3.5 w-3.5" />
                {ba.label}
              </button>
            ))}
            <button onClick={clearSelection} className="text-xs text-[var(--text-lo)] hover:text-[var(--text-hi)]">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div
        className={tableMaxHeight ? "w-full overflow-auto scrollbar-thin scrollbar-thumb-[var(--border)] scrollbar-track-transparent" : "w-full overflow-x-auto overflow-y-visible"}
        style={tableMaxHeight ? { maxHeight: tableMaxHeight } : undefined}
      >
        <table
          className="min-w-full border-collapse"
          style={Object.keys(columnWidths).length > 0 ? { tableLayout: "fixed" } : undefined}
        >
          <colgroup>
            {canSelect && <col className="w-10" />}
            {visibleColumns.map((col, i) => (
              <col key={i} style={columnWidths[String(col.accessor)] ? { width: columnWidths[String(col.accessor)] } : undefined} />
            ))}
            {actions.length > 0 && <col />}
          </colgroup>

          <TableHeader
            columns={visibleColumns as Column[]}
            table={{ paged: paginated, selected, sortKey, sortDir, toggleAll, allPageSel, somePageSel, toggleSort }}
            selectable={canSelect}
            hasActions={actions.length > 0}
            stickyHeader={derivedStickyHeader}
            columnWidths={columnWidths}
            onColumnResize={(accessor, w) => setColumnWidths((prev) => ({ ...prev, [accessor]: w }))}
          />

          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className={cn("border-b border-slate-200/60 dark:border-slate-800/60", i % 2 !== 0 && "bg-[var(--surface-2)]/30")}>
                  {canSelect && <td className="px-3 py-3.5 border-r border-[var(--border)]"><Skeleton className="h-4 w-4" /></td>}
                  {visibleColumns.map((col) => (
                    <td key={String(col.accessor)} className="px-4 py-3.5">
                      <Skeleton className="h-4 w-full max-w-[160px]" />
                    </td>
                  ))}
                  {actions.length > 0 && <td className="px-4 py-3.5"><Skeleton className="h-4 w-16" /></td>}
                </tr>
              ))
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + (canSelect ? 1 : 0) + (actions.length > 0 ? 1 : 0)}>
                  <EmptyState icon={emptyIcon} title={emptyMessage} className="py-12" />
                </td>
              </tr>
            ) : (
              paginated.map((row, i) => {
                const id = rowId(row, page * pageSize + i);
                return (
                  <TableRow
                    key={id}
                    row={row}
                    rowIndex={i}
                    columns={visibleColumns}
                    selectable={canSelect}
                    selected={selected.has(id)}
                    onToggleSelect={() => toggleRow(id)}
                    actions={actions}
                    onRowClick={onRowClick}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ───────────────────────────────────────────────────── */}
      {!loading && total > 0 && (
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={(n) => { setPageSize(n); setPage(0); }}
        />
      )}

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        users={(exportRows ?? dateFiltered) as Record<string, unknown>[]}
        mode="light"
        type={title?.toLowerCase().replace(/\s+/g, "_") || "records"}
        title={title}
      />
    </div>
  );
}
