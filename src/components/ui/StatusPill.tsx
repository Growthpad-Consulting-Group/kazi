import { Icon } from "@iconify/react";
import { cn } from "@/shared/lib/cn";

type PillContext = "stage" | "boolean" | "priority" | "default";

interface PillConfig {
  icon: string;
  label: string;
  className: string;
}

const stageConfig: Record<string, PillConfig> = {
  applied: {
    icon: "solar:user-broken",
    label: "Applied",
    className:
      "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20",
  },
  screened: {
    icon: "solar:cpu-bolt-broken",
    label: "Screened",
    className:
      "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  interview: {
    icon: "solar:chat-round-dots-broken",
    label: "Interview",
    className:
      "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
  },
  offer: {
    icon: "solar:tag-price-broken",
    label: "Offer",
    className:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  hired: {
    icon: "solar:check-circle-broken",
    label: "Hired",
    className:
      "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  },
  rejected: {
    icon: "solar:close-circle-broken",
    label: "Rejected",
    className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  },
};

const priorityConfig: Record<string, PillConfig> = {
  low: {
    icon: "solar:arrow-down-broken",
    label: "Low",
    className:
      "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20",
  },
  medium: {
    icon: "solar:minus-broken",
    label: "Medium",
    className:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  high: {
    icon: "solar:arrow-up-broken",
    label: "High",
    className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  },
};

/** Shared colour vocabulary for status words used across jobs, reviews, goals, surveys… */
const SUCCESS =
  "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20";
const INFO =
  "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
const ACCENT =
  "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20";
const AMBER =
  "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
const RED = "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
const NEUTRAL =
  "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20";

const statusConfig: Record<string, PillConfig> = {
  // Jobs
  open: {
    icon: "solar:check-circle-broken",
    label: "Open",
    className: SUCCESS,
  },
  closed: {
    icon: "solar:close-circle-broken",
    label: "Closed",
    className: NEUTRAL,
  },
  draft: { icon: "solar:pen-broken", label: "Draft", className: AMBER },
  archived: {
    icon: "solar:archive-broken",
    label: "Archived",
    className: NEUTRAL,
  },
  hired: {
    icon: "solar:check-circle-broken",
    label: "Hired",
    className: SUCCESS,
  },
  // Reviews / surveys / goals / check-ins / IDPs
  pending: {
    icon: "solar:clock-circle-broken",
    label: "Pending",
    className: AMBER,
  },
  completed: {
    icon: "solar:check-circle-broken",
    label: "Completed",
    className: SUCCESS,
  },
  active: {
    icon: "solar:play-circle-broken",
    label: "Active",
    className: SUCCESS,
  },
  cancelled: {
    icon: "solar:close-circle-broken",
    label: "Cancelled",
    className: RED,
  },
  submitted: {
    icon: "solar:check-circle-broken",
    label: "Submitted",
    className: INFO,
  },
  reviewed: {
    icon: "solar:check-circle-broken",
    label: "Reviewed",
    className: SUCCESS,
  },
  self_review: {
    icon: "solar:user-broken",
    label: "Self Review",
    className: INFO,
  },
  manager_review: {
    icon: "solar:user-broken",
    label: "Manager Review",
    className: ACCENT,
  },
  peer_review: {
    icon: "solar:users-group-broken",
    label: "Peer Review",
    className: ACCENT,
  },
  not_started: {
    icon: "solar:minus-circle-broken",
    label: "Not Started",
    className: NEUTRAL,
  },
  in_progress: {
    icon: "solar:play-circle-broken",
    label: "In Progress",
    className: INFO,
  },
  at_risk: {
    icon: "solar:danger-triangle-broken",
    label: "At Risk",
    className: RED,
  },
  paused: {
    icon: "solar:pause-circle-broken",
    label: "Paused",
    className: AMBER,
  },
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

  if (
    context === "stage" &&
    typeof value === "string" &&
    stageConfig[value.toLowerCase()]
  ) {
    config = stageConfig[value.toLowerCase()];
  } else if (context === "boolean") {
    config = value
      ? {
          icon: "solar:check-circle-broken",
          label: "Yes",
          className:
            "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
        }
      : {
          icon: "solar:close-circle-broken",
          label: "No",
          className:
            "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
        };
  } else if (
    context === "priority" &&
    typeof value === "string" &&
    priorityConfig[value.toLowerCase()]
  ) {
    config = priorityConfig[value.toLowerCase()];
  } else if (typeof value === "string" && statusConfig[value.toLowerCase()]) {
    config = statusConfig[value.toLowerCase()];
  } else {
    config = {
      icon: "solar:circle-broken",
      label: String(value),
      className:
        "bg-[var(--surface-2)] text-[var(--text-lo)] border-[var(--border)]",
    };
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className,
      )}
    >
      <Icon icon={config.icon} className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}
