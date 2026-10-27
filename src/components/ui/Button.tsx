"use client";

import Link from "next/link";
import { cn } from "@/shared/lib/cn";
import { Icon } from "@iconify/react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

const variantClasses: Record<ButtonVariant, string> = {
  primary:   "bg-brand-500 text-white hover:bg-brand-600 shadow-sm",
  secondary: "bg-[var(--surface)] text-[var(--text-hi)] border border-[var(--border)] hover:bg-[var(--surface-2)]",
  ghost:     "text-[var(--text-lo)] hover:bg-[var(--surface-2)] hover:text-[var(--text-hi)]",
  danger:    "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  disabled,
  loading,
  onClick,
  type = "button",
  className,
  href,
}: {
  children?: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  className?: string;
  /** Renders a link styled as a button instead of a button element. */
  href?: string;
}) {
  const classes = cn(
    "inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
    variantClasses[variant],
    sizeClasses[size],
    className
  );
  const content = (
    <>
      {loading ? (
        <Icon icon="solar:spinner-broken" className="animate-spin w-4 h-4" />
      ) : icon ? (
        <Icon icon={icon} className="w-4 h-4 shrink-0" />
      ) : null}
      {children}
    </>
  );
  if (href) return <Link href={href} className={classes}>{content}</Link>;
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} className={classes}>
      {content}
    </button>
  );
}
