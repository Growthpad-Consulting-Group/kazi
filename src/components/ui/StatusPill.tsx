import { Icon } from "@iconify/react";
import { cn } from "@/shared/lib/cn";

type PillContext = "stage" | "boolean" | "priority" | "default";

interface PillConfig {
  icon: string;
  label: string;
  className: string;
}

const stageConfig: Record<string, PillConfig> = {
  applied:   { icon: "solar:user-broken",          label: "Applied",    className: "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20" },
  screened:  { icon: "solar:cpu-bolt-broken",       label: "Screened",   className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  interview: { icon: "solar:chat-round-dots-broken", label: "Interview",  className: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20" },
  offer:     { icon: "solar:tag-price-broken",      label: "Offer",      className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  hired:     { icon: "solar:check-circle-broken",   label: "Hired",      className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20" },
  rejected:  { icon: "solar:close-circle-broken",   label: "Rejected",   className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" },
};

const priorityConfig: Record<string, PillConfig> = {
  low:      { icon: "solar:arrow-down-broken",  label: "Low",      className: "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20" },
  medium:   { icon: "solar:minus-broken",       label: "Medium",   className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  high:     { icon: "solar:arrow-up-broken",    label: "High",     className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" },
};

export function StatusPill({
  value,
  context = "default",
  className,
}: {
  value: string | boolean;
  context?: PillContext;
  className?: string;
}) {
  let config: PillConfig;

  if (context === "stage" && typeof value === "string") {
    config = stageConfig[value.toLowerCase()] ?? { icon: "solar:circle-broken", label: value, className: "bg-[var(--surface-2)] text-[var(--text-lo)] border-[var(--border)]" };
  } else if (context === "boolean") {
    config = value
      ? { icon: "solar:check-circle-broken", label: "Yes", className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20" }
      : { icon: "solar:close-circle-broken", label: "No",  className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" };
  } else if (context === "priority" && typeof value === "string") {
    config = priorityConfig[value.toLowerCase()] ?? { icon: "solar:circle-broken", label: value, className: "bg-[var(--surface-2)] text-[var(--text-lo)] border-[var(--border)]" };
  } else {
    config = { icon: "solar:circle-broken", label: String(value), className: "bg-[var(--surface-2)] text-[var(--text-lo)] border-[var(--border)]" };
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", config.className, className)}>
      <Icon icon={config.icon} className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}
