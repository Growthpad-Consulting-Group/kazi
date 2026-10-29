"use client";

import { useRef, ReactNode } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/lib/cn";
import type { Column } from "../GenericTable";

interface TableState {
  paged: unknown[];
  selected: Set<string>;
  sortKey: string | null;
  sortDir: "asc" | "desc";
  toggleAll: () => void;
  allPageSel: boolean;
  somePageSel: boolean;
  toggleSort: (key: string) => void;
}

interface TableHeaderProps {
  columns: Column[];
  table: TableState;
  selectable: boolean;
  hasActions: boolean;
  stickyHeader?: boolean;
  columnWidths?: Record<string, number>;
  onColumnResize?: (accessor: string, width: number) => void;
}

const MIN_COL_WIDTH = 60;

export default function TableHeader({
  columns,
  table,
  selectable,
  hasActions,
  stickyHeader = false,
  columnWidths = {},
  onColumnResize,
}: TableHeaderProps) {
  const dragState = useRef<{
    th: HTMLTableCellElement;
    startX: number;
    startWidth: number;
    accessor: string;
  } | null>(null);
  const rowRef = useRef<HTMLTableRowElement>(null);

  const handleResizeStart = (e: React.MouseEvent, accessor: string) => {
    e.preventDefault();
    e.stopPropagation();
    const th = (e.currentTarget as HTMLElement).closest(
      "th",
    ) as HTMLTableCellElement | null;
    if (!th) return;

    if (
      Object.keys(columnWidths).length === 0 &&
      onColumnResize &&
      rowRef.current
    ) {
      const offset = selectable ? 1 : 0;
      const cells = rowRef.current.querySelectorAll("th");
      columns.forEach((c, i) => {
        const el = cells[i + offset];
        if (el)
          onColumnResize(String(c.accessor), el.getBoundingClientRect().width);
      });
    }

    dragState.current = {
      th,
      startX: e.clientX,
      startWidth: th.getBoundingClientRect().width,
      accessor,
    };

    const onMove = (ev: MouseEvent) => {
      if (!dragState.current) return;
      const w = Math.max(
        MIN_COL_WIDTH,
        dragState.current.startWidth + (ev.clientX - dragState.current.startX),
      );
      dragState.current.th.style.width = `${w}px`;
      dragState.current.th.style.minWidth = `${w}px`;
    };
    const onUp = () => {
      if (dragState.current) {
        const w = Math.max(
          MIN_COL_WIDTH,
          dragState.current.th.getBoundingClientRect().width,
        );
        onColumnResize?.(dragState.current.accessor, w);
      }
      dragState.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  return (
    <thead
      className={cn(
        "bg-[var(--surface-2)] transition-colors",
        stickyHeader && "sticky top-0 z-20",
      )}
    >
      <tr ref={rowRef}>
        {selectable && (
          <th className="w-10 px-3 py-3.5 border-b border-r border-slate-200/60 dark:border-slate-800/60 bg-[var(--surface-2)] sticky left-0 top-0 z-30">
            <input
              type="checkbox"
              checked={table.allPageSel}
              ref={(el) => {
                if (el)
                  el.indeterminate = table.somePageSel && !table.allPageSel;
              }}
              onChange={table.toggleAll}
              className="h-4 w-4 rounded border-[var(--border)] accent-brand-500 cursor-pointer"
            />
          </th>
        )}

        {columns.map((col, idx) => {
          const accessor = String(col.accessor);
          const style: React.CSSProperties = {};
          if (col.width) {
            style.width = col.width;
            style.minWidth = col.width;
          }
          if (columnWidths[accessor]) {
            style.width = columnWidths[accessor];
            style.minWidth = columnWidths[accessor];
          }

          return (
            <th
              key={`${accessor}-${idx}`}
              style={style}
              className={cn(
                "group/col relative px-4 py-3.5 border-b border-slate-200/80 dark:border-slate-800/80 text-left text-md font-semibold text-[var(--text-lo)] bg-[var(--surface-2)] select-none",
                col.sortable &&
                  "cursor-pointer hover:text-[var(--text-hi)] transition-colors",
                col.headerClassName,
              )}
              onClick={() => col.sortable && table.toggleSort(accessor)}
            >
              <div className="flex items-center gap-1.5">
                <span className="truncate">{col.header}</span>
                {col.sortable !== false && (
                  <div className="flex flex-col shrink-0">
                    <Icon
                      icon="solar:alt-arrow-up-broken"
                      className={cn(
                        "h-2.5 w-2.5",
                        table.sortKey === accessor && table.sortDir === "asc"
                          ? "text-brand-500"
                          : "opacity-20",
                      )}
                    />
                    <Icon
                      icon="solar:alt-arrow-down-broken"
                      className={cn(
                        "h-2.5 w-2.5 -mt-0.5",
                        table.sortKey === accessor && table.sortDir === "desc"
                          ? "text-brand-500"
                          : "opacity-20",
                      )}
                    />
                  </div>
                )}
              </div>

              {onColumnResize && (
                <div
                  role="separator"
                  onMouseDown={(e) => handleResizeStart(e, accessor)}
                  onClick={(e) => e.stopPropagation()}
                  className="group/handle absolute top-0 -right-1.5 h-full w-3 cursor-col-resize select-none z-10 flex justify-center"
                >
                  <div className="w-px h-full opacity-0 group-hover/handle:opacity-100 bg-brand-500/50 group-active/handle:bg-brand-500 transition-opacity" />
                </div>
              )}
            </th>
          );
        })}

        {hasActions && (
          <th className="sticky right-0 top-0 z-20 px-4 py-3.5 border-b border-l border-slate-200/60 dark:border-slate-800/60 bg-[var(--surface-2)] text-left text-md font-semibold text-[var(--text-lo)]">
            Actions
          </th>
        )}
      </tr>
    </thead>
  );
}
