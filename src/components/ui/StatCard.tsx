"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import type { ReactNode } from "react";

export type StatCardColor = "orange" | "slate" | "violet" | "amber" | "green" | "blue" | "red";
export type StatCardVariant = "gradient" | "flat";

const styles: Record<StatCardColor, { gradient: string; shadow: string; flat: string }> = {
  orange: { gradient: "from-[#f05d23] to-orange-400", shadow: "shadow-[#f05d23]/25", flat: "text-[#f05d23] bg-[#f05d23]/10" },
  slate:  { gradient: "from-slate-500 to-slate-400",   shadow: "shadow-slate-500/20",  flat: "text-slate-500 bg-slate-500/10" },
  violet: { gradient: "from-violet-500 to-violet-400", shadow: "shadow-violet-500/25", flat: "text-violet-500 bg-violet-500/10" },
  amber:  { gradient: "from-amber-500 to-amber-400",   shadow: "shadow-amber-500/25",  flat: "text-amber-500 bg-amber-500/10" },
  green:  { gradient: "from-emerald-500 to-emerald-400", shadow: "shadow-emerald-500/25", flat: "text-emerald-500 bg-emerald-500/10" },
  blue:   { gradient: "from-blue-500 to-blue-400",     shadow: "shadow-blue-500/25",   flat: "text-blue-500 bg-blue-500/10" },
  red:    { gradient: "from-red-500 to-red-400",       shadow: "shadow-red-500/25",    flat: "text-red-500 bg-red-500/10" },
};

interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  color?: StatCardColor;
  variant?: StatCardVariant;
  subtitle?: ReactNode;
  href?: string;
  onClick?: () => void;
  compact?: boolean;
}

/** Stat card with two visual variants: "gradient" (default, bold icon) and "flat" (quiet, tinted icon). */
export default function StatCard({ title, value, icon, color = "orange", variant = "gradient", subtitle, href, onClick, compact = false }: StatCardProps) {
  const palette = styles[color];
  const className = `group relative block overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-left shadow-xl shadow-slate-200/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:shadow-black/20 ${compact ? "p-3" : "p-4"}`;

  const content = variant === "gradient" ? (
    <>
      <div className={`pointer-events-none absolute -right-10 -top-10 rounded-full bg-gradient-to-br ${palette.gradient} opacity-10 transition-transform duration-500 group-hover:scale-125 ${compact ? "h-20 w-20" : "h-28 w-28"}`} />
      <div className="relative flex items-center gap-3">
        <div className={`flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${palette.gradient} shadow-lg ${palette.shadow} ${compact ? "h-9 w-9" : "h-11 w-11"}`}><Icon icon={icon} className={`${compact ? "h-4 w-4" : "h-5 w-5"} text-white`} /></div>
        <div className="min-w-0"><p className={`font-mono font-bold leading-none text-[var(--text-hi)] ${compact ? "text-xl" : "text-2xl"}`}>{value}</p><p className={`${compact ? "mt-1 text-xs" : "mt-1.5 text-sm"} font-semibold text-[var(--text-hi)]`}>{title}</p>{subtitle && <div className="mt-0.5 truncate font-mono text-[10px] text-[var(--text-lo)]">{subtitle}</div>}</div>
      </div>
    </>
  ) : (
    <>
      <span className={`flex ${compact ? "h-8 w-8" : "h-9 w-9"} items-center justify-center rounded-xl ${palette.flat}`}>
        <Icon icon={icon} className={compact ? "h-4 w-4" : "h-4.5 w-4.5"} />
      </span>
      <p className={`mt-3 font-mono font-bold ${palette.flat.split(" ")[0]} ${compact ? "text-xl" : "text-2xl"}`}>{value}</p>
      <p className={`mt-0.5 ${compact ? "text-xs" : "text-sm"} font-semibold text-[var(--text-hi)]`}>{title}</p>
      {subtitle && <p className="mt-0.5 truncate text-[11px] text-[var(--text-lo)]">{subtitle}</p>}
    </>
  );

  if (href) return <Link href={href} className={className}>{content}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={`w-full cursor-pointer ${className}`}>{content}</button>;
  return <div className={className}>{content}</div>;
}
