import { Icon } from "@iconify/react";
import { cn } from "@/shared/lib/cn";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 text-center",
        className,
      )}
    >
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-2)] border border-[var(--border)]">
          <Icon icon={icon} className="h-7 w-7 text-[var(--text-lo)]" />
        </div>
      )}
      <h3 className="text-md font-semibold text-[var(--text-hi)]">{title}</h3>
      {description && (
        <p className="mt-1 max-w-xs text-xs text-[var(--text-lo)]">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
