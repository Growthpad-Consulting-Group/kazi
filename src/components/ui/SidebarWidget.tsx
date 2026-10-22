import { Icon } from "@iconify/react";
import React from "react";

interface SidebarWidgetProps {
  title: string;
  icon?: string;
  /** Icon chip classes, e.g. "bg-brand-500/15 text-brand-500" */
  iconClass?: string;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
  noBodyPadding?: boolean;
}

/**
 * Compact card used to group a page's metadata/utility controls in a
 * sticky sidebar (status, summary, meta, actions). Ported from bflowpos,
 * restyled for Kazi's design tokens.
 */
export default function SidebarWidget({
  title,
  icon,
  iconClass,
  children,
  headerAction,
  noBodyPadding = false,
}: SidebarWidgetProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/50 hover:shadow-2xl dark:shadow-black/20 transition-shadow duration-200">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          {icon && (
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-xl ${
                iconClass ?? "bg-[var(--surface-2)] text-[var(--text-lo)]"
              }`}
            >
              <Icon icon={icon} className="h-3.5 w-3.5" />
            </div>
          )}
          <span className="text-md font-semibold text-[var(--text-lo)]">
            {title}
          </span>
        </div>
        {headerAction}
      </div>
      <div className={noBodyPadding ? "" : "p-5"}>{children}</div>
    </div>
  );
}
