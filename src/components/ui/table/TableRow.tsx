"use client";

import { useState, useRef, useEffect, useCallback, MouseEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/lib/cn";
import { getNestedValue, isDateField, formatDateValue } from "./TableUtils";
import type { Column, RowAction } from "../GenericTable";

interface TableRowProps<T extends Record<string, unknown>> {
  row: T;
  rowIndex: number;
  columns: Column<T>[];
  selectable: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  actions: RowAction<T>[];
  onRowClick?: (row: T) => void;
}

export default function TableRow<T extends Record<string, unknown>>({
  row,
  rowIndex,
  columns,
  selectable,
  selected,
  onToggleSelect,
  actions,
  onRowClick,
}: TableRowProps<T>) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isEven = rowIndex % 2 === 0;

  const openDropdown = useCallback((e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 4, left: rect.right - 200 });
    setShowDropdown((v) => !v);
  }, []);

  useEffect(() => {
    if (!showDropdown) return;
    const close = (e: Event) => {
      const t = e.target as Node;
      if (
        dropdownRef.current && !dropdownRef.current.contains(t) &&
        triggerRef.current && !triggerRef.current.contains(t)
      ) setShowDropdown(false);
    };
    const closeScroll = () => setShowDropdown(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("scroll", closeScroll, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("scroll", closeScroll, true);
    };
  }, [showDropdown]);

  const visibleActions = actions.filter((a) => !a.show || a.show(row));
  const rowBg = selected ? "bg-[#f05d23]/5" : isEven ? "bg-[var(--surface)]" : "bg-[var(--surface-2)]/30";

  const handleRowClick = (e: MouseEvent<HTMLTableRowElement>) => {
    if ((e.target as Element).closest("button") || (e.target as Element).closest('input[type="checkbox"]')) return;
    onRowClick?.(row);
  };

  return (
    <tr
      onClick={handleRowClick}
      className={cn(
        "group border-b border-[var(--border)] last:border-0 transition-colors duration-150",
        rowBg,
        onRowClick ? "cursor-pointer hover:bg-[#f05d23]/5" : "hover:bg-[var(--surface-2)]/60",
        showDropdown && "relative z-60"
      )}
    >
      {selectable && (
        <td
          className={cn(
            "sticky left-0 z-10 w-10 px-3 py-3.5 border-r border-[var(--border)] transition-colors duration-150",
            rowBg, "group-hover:bg-[#f05d23]/5"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="h-4 w-4 rounded border-[var(--border)] accent-[#f05d23] cursor-pointer"
          />
        </td>
      )}

      {columns.map((col, i) => {
        const accessor = String(col.accessor);
        const value = getNestedValue(row, accessor);

        let display: ReactNode;
        if (col.render) {
          display = col.render(row, value);
        } else if (isDateField(accessor) && value) {
          display = <span className="text-[var(--text-lo)] whitespace-nowrap">{formatDateValue(value)}</span>;
        } else {
          const str = value == null ? "—" : String(value);
          display = <div className="truncate">{str}</div>;
        }

        return (
          <td
            key={`${accessor}-${i}`}
            className={cn("px-4 py-3.5 text-sm text-[var(--text-hi)]", col.className)}
          >
            {display}
          </td>
        );
      })}

      {visibleActions.length > 0 && (
        <td
          className={cn(
            "sticky right-0 z-10 px-3 py-3.5 border-l border-[var(--border)] transition-colors duration-150",
            rowBg, "group-hover:bg-[#f05d23]/5"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-0.5">
            {(() => {
              const primary = visibleActions.length <= 4 ? visibleActions : visibleActions.slice(0, 3);
              const overflow = visibleActions.length > 4 ? visibleActions.slice(3) : [];

              return (
                <>
                  {primary.map((action, ai) => {
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
                            : "text-[var(--text-lo)] hover:bg-[var(--surface-2)] hover:text-[#f05d23]"
                        )}
                      >
                        <Icon icon={ic} className="h-4 w-4" />
                      </button>
                    );
                  })}

                  {overflow.length > 0 && (
                    <div ref={triggerRef}>
                      <button
                        onClick={openDropdown}
                        title="More actions"
                        className="rounded-lg p-1.5 text-[var(--text-lo)] hover:bg-[var(--surface-2)] hover:text-[var(--text-hi)] transition-all"
                      >
                        <Icon icon="solar:menu-dots-broken" className="h-4 w-4" />
                      </button>

                      {showDropdown && typeof document !== "undefined" &&
                        createPortal(
                          <div
                            ref={dropdownRef}
                            className="fixed z-[9999] min-w-[200px] rounded-2xl shadow-2xl shadow-black/20 ring-1 ring-[var(--border)] overflow-hidden bg-[var(--surface)]"
                            style={{ top: dropdownPos.top, left: Math.max(8, dropdownPos.left) }}
                          >
                            <div className="p-1.5">
                              {overflow.map((action, ai) => {
                                const ic    = typeof action.icon  === "function" ? action.icon(row)  : action.icon;
                                const label = typeof action.label === "function" ? action.label(row) : action.label;
                                return (
                                  <button
                                    key={ai}
                                    onClick={() => { action.onClick(row); setShowDropdown(false); }}
                                    className={cn(
                                      "flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left rounded-xl transition-all",
                                      action.variant === "danger"
                                        ? "text-red-500 hover:bg-red-500/10"
                                        : "text-[var(--text-hi)] hover:bg-[var(--surface-2)] hover:translate-x-1"
                                    )}
                                  >
                                    <Icon icon={ic} className="h-4 w-4 shrink-0" />
                                    <span className="font-medium">{label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>,
                          document.body
                        )}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </td>
      )}
    </tr>
  );
}
