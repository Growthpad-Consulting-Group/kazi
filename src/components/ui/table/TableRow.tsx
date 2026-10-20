"use client";

import { useState, useRef, useEffect, useCallback, MouseEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/lib/cn";
import { getNestedValue, isDateField, formatDateValue } from "./TableUtils";
import type { Column, RowAction, RowActionVariant } from "../GenericTable";
import TooltipIconButton from "../TooltipIconButton";


/** Tinted button colours per RowAction variant, styled after bflowpos. */
function actionVariantClass(variant: RowActionVariant = "default"): string {
  switch (variant) {
    case "danger":
      return "bg-red-500/10 text-red-500 hover:bg-red-500/20 dark:bg-red-500/15 dark:text-red-400 dark:hover:bg-red-500/25";
    case "warning":
      return "bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 dark:bg-amber-500/15 dark:text-amber-400 dark:hover:bg-amber-500/25";
    case "success":
      return "bg-green-500/10 text-green-600 hover:bg-green-500/20 dark:bg-green-500/15 dark:text-green-400 dark:hover:bg-green-500/25";
    case "info":
      return "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 dark:bg-blue-500/15 dark:text-blue-400 dark:hover:bg-blue-500/25";
    default:
      return "bg-[#f05d23]/10 text-[#f05d23] hover:bg-[#f05d23]/20";
  }
}

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
        "group border-b border-slate-200/60 dark:border-slate-800/60 last:border-0 transition-colors duration-150",
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
            "sticky right-0 z-10 px-3 py-3.5 border-l border-slate-200/60 dark:border-slate-800/60 transition-colors duration-150",
            rowBg, "group-hover:bg-[#f05d23]/5"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            {(() => {
              const primary = visibleActions.length <= 4 ? visibleActions : visibleActions.slice(0, 3);
              const overflow = visibleActions.length > 4 ? visibleActions.slice(3) : [];

              return (
                <>
                  {primary.map((action, ai) => {
                    const ic    = typeof action.icon  === "function" ? action.icon(row)  : action.icon;
                    const label = typeof action.label === "function" ? action.label(row) : action.label;
                    return (
                      <TooltipIconButton
                        key={ai}
                        icon={ic}
                        label={label}
                        onClick={() => action.onClick(row)}
                        className={cn(
                          "transition-all active:scale-95 rounded-xl p-1.5",
                          actionVariantClass(action.variant),
                          typeof action.className === "function" ? action.className(row) : action.className
                        )}
                        iconClassName="h-4 w-4"
                        position="bottom"
                      />
                    );
                  })}

                  {overflow.length > 0 && (
                    <div ref={triggerRef}>
                      <button
                        onClick={openDropdown}
                        title="More actions"
                        className="rounded-xl bg-[var(--surface-2)] p-1.5 text-[var(--text-lo)] hover:bg-[#f05d23]/10 hover:text-[#f05d23] transition-all"
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
