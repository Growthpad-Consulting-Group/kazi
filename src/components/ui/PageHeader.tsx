import { Icon } from "@iconify/react";
import { ReactNode } from "react";

interface PageHeaderAction {
  label: string;
  icon?: string;
  variant?: "primary" | "secondary";
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}

interface PageHeaderProps {
  title: string;
  description?: string | ReactNode;
  icon?: string;
  iconBgColor?: string;
  actions?: PageHeaderAction[];
  children?: ReactNode;
  className?: string;
}

export default function PageHeader({
  title,
  description,
  icon,
  iconBgColor = "bg-[#f05d23]/10",
  actions = [],
  children,
  className = "",
}: PageHeaderProps) {
  return (
    <div className={`mb-6 ${className}`}>
      <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 py-5 shadow-lg shadow-black/5 transition-all duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            {icon && (
              <div className={`w-11 h-11 ${iconBgColor} rounded-xl flex items-center justify-center shrink-0`}>
                <Icon icon={icon} className="w-5 h-5 text-[#f05d23]" />
              </div>
            )}
            <div>
              <h1 className="font-display text-xl font-semibold text-[var(--text-hi)]">{title}</h1>
              {description && <div className="text-sm mt-0.5 text-[var(--text-lo)]">{description}</div>}
            </div>
          </div>

          {(actions.length > 0 || children) && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {children}
              {actions.map((action, i) =>
                action.href ? (
                  <a
                    key={i}
                    href={action.href}
                    className={
                      action.variant === "primary"
                        ? "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#f05d23] text-white hover:bg-[#d94f1e] transition-colors"
                        : "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border)] bg-[var(--surface)] text-[var(--text-hi)] hover:bg-[var(--surface-2)] transition-colors"
                    }
                  >
                    {action.icon && <Icon icon={action.icon} className="w-4 h-4" />}
                    {action.label}
                  </a>
                ) : (
                  <button
                    key={i}
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className={
                      action.variant === "primary"
                        ? "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#f05d23] text-white hover:bg-[#d94f1e] transition-colors disabled:opacity-50"
                        : "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border)] bg-[var(--surface)] text-[var(--text-hi)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50"
                    }
                  >
                    {action.icon && <Icon icon={action.icon} className="w-4 h-4" />}
                    {action.label}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
