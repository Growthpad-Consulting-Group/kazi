"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { Calendar } from "react-date-range";
import { Icon } from "@iconify/react";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";

interface DatePickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
}

function toDate(value?: string) {
  return value ? new Date(`${value}T12:00:00`) : undefined;
}

function toValue(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  minDate,
  maxDate,
  className = "",
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const selected = toDate(value);

  const positionPopover = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 24);
    const height = popoverRef.current?.getBoundingClientRect().height ?? 390;
    const margin = 12;
    const left = Math.max(
      margin,
      Math.min(rect.left, window.innerWidth - width - margin),
    );
    const top = Math.max(
      margin,
      Math.min(rect.bottom + 6, window.innerHeight - height - margin),
    );
    setStyle({ position: "fixed", top, left, width, zIndex: 9999 });
  }, []);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(positionPopover);
    window.addEventListener("resize", positionPopover);
    window.addEventListener("scroll", positionPopover, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", positionPopover);
      window.removeEventListener("scroll", positionPopover, true);
    };
  }, [open, positionPopover]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !popoverRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      )
        setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-hi)] outline-none transition-colors hover:border-brand-500/40 focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10 ${open ? "border-brand-500/60" : "border-[var(--border)]"}`}
      >
        <span className={selected ? "" : "text-[var(--text-lo)]"}>
          {selected ? format(selected, "MMM d, yyyy") : placeholder}
        </span>
        <Icon
          icon="solar:calendar-date-broken"
          className="h-4 w-4 shrink-0 text-[var(--text-lo)]"
        />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            style={style}
            role="dialog"
            aria-label="Choose date"
            className="max-h-[calc(100vh-24px)] overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-2xl"
          >
            <div className="kazi-calendar">
              <Calendar
                date={selected ?? new Date()}
                onChange={(date) => {
                  onChange(toValue(date));
                  setOpen(false);
                  window.requestAnimationFrame(() =>
                    triggerRef.current?.focus(),
                  );
                }}
                minDate={minDate}
                maxDate={maxDate}
                color="#f05d23"
                className="w-full"
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export default DatePicker;
