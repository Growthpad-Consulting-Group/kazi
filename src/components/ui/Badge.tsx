"use client";

import { cn } from "@/shared/lib/cn";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-[var(--surface-2)] text-[var(--text-lo)] border-[var(--border)]",
  success:
    "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  warning:
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  danger: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  info: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
};

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center border font-mono text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-md",
        variantClasses[variant],
        className,
      )}
    >
      [ {children} ]
    </span>
  );
}
