"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import type { ReactNode } from "react";

export type StatCardColor =
  "orange" | "slate" | "violet" | "amber" | "green" | "blue" | "red";
export type StatCardVariant = "inline";

const tints: Record<StatCardColor, string> = {
  orange: "text-brand-500 bg-brand-500/10",
  slate: "text-slate-500 bg-slate-500/10",
  violet: "text-violet-500 bg-violet-500/10",
  amber: "text-amber-500 bg-amber-500/10",
  green: "text-emerald-500 bg-emerald-500/10",
  blue: "text-blue-500 bg-blue-500/10",
  red: "text-red-500 bg-red-500/10",
};

interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  color?: StatCardColor;
  /** Kept for existing call sites; the inline row is the only layout. */
  variant?: StatCardVariant;
  subtitle?: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
  compact?: boolean;
  /** Stacks the label above the value. */
  inlineStacked?: boolean;
}

/** Stat card rendered as a compact inline row: icon, value and label on one line. */
export default function StatCard({
  title,
  value,
  icon,
  color = "orange",
  subtitle,
  href,
  onClick,
  className: customClassName,
  compact = false,
  inlineStacked = false,
}: StatCardProps) {
  const tint = tints[color];
  const valueTone = tint.split(" ")[0];
  const className = `group relative block overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-left shadow-xl shadow-slate-200/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:shadow-black/20 ${compact ? "p-3" : "p-4"} ${customClassName ?? ""}`;
  const valueClass = `font-bold capitalize leading-none ${valueTone} ${compact ? "text-lg" : "text-xl"}`;

  const content = (
    <div className="relative flex min-w-0 items-center gap-2.5">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tint}`}
      >
        <Icon icon={icon} className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        {inlineStacked ? (
          <>
            <p className="truncate text-sm font-semibold text-[var(--text-hi)]">
              {title}
            </p>
            <p className={`mt-1 ${valueClass}`}>{value}</p>
          </>
        ) : (
          <div className="flex items-baseline gap-1.5">
            <p className={valueClass}>{value}</p>
            <p className="truncate text-sm font-semibold text-[var(--text-hi)]">
              {title}
            </p>
          </div>
        )}
        {subtitle && (
          <p className="mt-1 truncate text-xs text-[var(--text-lo)]">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );

  if (href)
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  if (onClick)
    return (
      <button
        type="button"
        onClick={onClick}
        className={`w-full cursor-pointer ${className}`}
      >
        {content}
      </button>
    );
  return <div className={className}>{content}</div>;
}
