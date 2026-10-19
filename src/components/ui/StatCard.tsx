"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/lib/cn";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  iconColor?: string;
  iconBg?: string;
  note?: string;
  href?: string;
  onClick?: () => void;
  trend?: { value: number; label?: string };
  className?: string;
}

export function StatCard({
  label,
  value,
  icon,
  iconColor = "text-[#f05d23]",
  iconBg = "from-[#f05d23]/20 to-[#f05d23]/5",
  note,
  href,
  onClick,
  trend,
  className,
}: StatCardProps) {
  const content = (
    <div className={cn(
      "relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-all duration-300 hover:shadow-lg hover:scale-[1.01] group",
      (href || onClick) && "cursor-pointer",
      className
    )}>
      {/* Decorative circle */}
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br opacity-30 blur-xl transition-opacity duration-500 group-hover:opacity-50"
        style={{ backgroundImage: `var(--tw-gradient-stops)` }}
      />

      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-[var(--text-lo)] uppercase tracking-wide">{label}</p>
          <p className="mt-2 text-3xl font-bold text-[var(--text-hi)] leading-none">{value}</p>
          {note && (
            <p className="mt-1.5 text-xs text-[var(--text-lo)]">{note}</p>
          )}
          {trend && (
            <div className={cn("mt-2 flex items-center gap-1 text-xs font-medium", trend.value >= 0 ? "text-green-500" : "text-red-500")}>
              <Icon icon={trend.value >= 0 ? "solar:arrow-right-up-broken" : "solar:arrow-right-down-broken"} className="w-3.5 h-3.5" />
              <span>{trend.value >= 0 ? "+" : ""}{trend.value}%</span>
              {trend.label && <span className="text-[var(--text-lo)]">{trend.label}</span>}
            </div>
          )}
        </div>

        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-sm", iconBg)}>
          <Icon icon={icon} className={cn("h-5 w-5", iconColor)} />
        </div>
      </div>
    </div>
  );

  if (href) return <Link href={href}>{content}</Link>;
  if (onClick) return <button onClick={onClick} className="w-full text-left">{content}</button>;
  return content;
}
