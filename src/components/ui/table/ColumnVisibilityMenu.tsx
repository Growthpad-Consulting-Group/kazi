"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import type { Column } from "../GenericTable";

interface Props<T> {
  /** Columns in display order. */
  columns: Column<T>[];
  hidden: Set<string>;
  onToggle: (id: string) => void;
  /** Receives the full new order of column ids, locked columns included. */
  onReorder: (orderedIds: string[]) => void;
}

/**
 * Popover with a draggable row per column: a checkbox to show or hide it, and a handle to reorder it.
 * Locked columns stay in their position and are left out of the list.
 */
export default function ColumnVisibilityMenu<T>({
  columns,
  hidden,
  onToggle,
  onReorder,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const toggleable = columns.filter((col) => !col.locked);
  const shown = columns.length - hidden.size;

  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination || source.index === destination.index) return;

    // Move within the toggleable columns, then put them back around the locked ones.
    const movable = toggleable.map((col) => String(col.accessor));
    const [moved] = movable.splice(source.index, 1);
    movable.splice(destination.index, 0, moved);

    let next = 0;
    const fullOrder = columns.map((col) =>
      col.locked ? String(col.accessor) : movable[next++],
    );
    onReorder(fullOrder);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        title={`Show, hide or reorder columns (${shown} of ${columns.length} shown)`}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-medium text-[var(--text-lo)] transition-all hover:bg-[var(--surface-2)] hover:text-[var(--text-hi)]"
      >
        <Icon icon="solar:tuning-square-2-broken" className="h-4 w-4" />
        Columns
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/50 dark:shadow-black/20">
          <div className="border-b border-[var(--border)] px-3 py-2.5">
            <p className="text-xs font-semibold text-[var(--text-hi)]">
              Show and order columns
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--text-lo)]">
              Drag to reorder • {shown} of {columns.length} shown
            </p>
          </div>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="table-columns">
              {(provided) => (
                <ul
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="max-h-80 space-y-0.5 overflow-y-auto p-1.5"
                >
                  {toggleable.map((col, index) => {
                    const id = String(col.accessor);
                    return (
                      <Draggable key={id} draggableId={id} index={index}>
                        {(drag, snapshot) => (
                          <li
                            ref={drag.innerRef}
                            {...drag.draggableProps}
                            className={`flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-sm text-[var(--text-hi)] transition-colors hover:bg-[var(--surface-2)] ${snapshot.isDragging ? "bg-[var(--surface-2)] shadow-lg" : ""}`}
                          >
                            <span
                              {...drag.dragHandleProps}
                              aria-label={`Drag to reorder ${col.header}`}
                              className="flex h-6 w-5 shrink-0 cursor-grab items-center justify-center text-[var(--text-lo)] active:cursor-grabbing"
                            >
                              <Icon
                                icon="solar:menu-dots-bold"
                                className="h-4 w-4"
                              />
                            </span>
                            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={!hidden.has(id)}
                                onChange={() => onToggle(id)}
                                className="h-4 w-4 accent-brand-500"
                              />
                              <span className="truncate">{col.header}</span>
                            </label>
                          </li>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </ul>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      )}
    </div>
  );
}
