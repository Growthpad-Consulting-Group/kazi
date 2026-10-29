"use client";

import { useId, useState, type ReactNode } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/lib/cn";

// Ported from bflowpos AccordionItem, using Kazi's surface and text tokens.
interface AccordionProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: string;
  badge?: ReactNode;
  children: ReactNode;
  /** Starting state when the accordion manages its own. Ignored when `open` is passed. */
  defaultOpen?: boolean;
  /** Pass `open` with `onToggle` to control the accordion from outside. */
  open?: boolean;
  onToggle?: (open: boolean) => void;
  className?: string;
}

export function Accordion({
  title,
  subtitle,
  icon,
  badge,
  children,
  defaultOpen = false,
  open,
  onToggle,
  className,
}: AccordionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const panelId = useId();
  const isOpen = open ?? internalOpen;

  const toggle = () => {
    const next = !isOpen;
    if (open === undefined) setInternalOpen(next);
    onToggle?.(next);
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]",
        className,
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-2)]"
      >
        <span className="flex min-w-0 flex-1 items-center gap-3">
          {icon && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
              <Icon icon={icon} className="h-4 w-4" />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-[var(--text-hi)]">
              {title}
            </span>
            {subtitle && (
              <span className="block truncate text-xs text-[var(--text-lo)]">
                {subtitle}
              </span>
            )}
          </span>
        </span>
        {badge && (
          <span className="shrink-0 rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs font-medium text-[var(--text-lo)]">
            {badge}
          </span>
        )}
        <Icon
          icon="solar:alt-arrow-down-broken"
          className={cn(
            "h-4 w-4 shrink-0 text-[var(--text-lo)] transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        />
      </button>
      {isOpen && (
        <div id={panelId} className="border-t border-[var(--border)] px-4 py-4">
          {children}
        </div>
      )}
    </div>
  );
}
