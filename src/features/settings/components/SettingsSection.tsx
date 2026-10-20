import { Icon } from "@iconify/react";
import { cn } from "@/shared/lib/cn";

interface Props {
  title: string;
  description?: string;
  icon: string;
  iconBg?: string;
  children: React.ReactNode;
  className?: string;
}

/** Card shell used across the settings pages. */
export default function SettingsSection({
  title,
  description,
  icon,
  iconBg = "bg-[#f05d23]/10 text-[#f05d23]",
  children,
  className,
}: Props) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/50 hover:shadow-2xl dark:shadow-black/20 transition-shadow duration-200",
        className
      )}
    >
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-6 py-4">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-xl", iconBg)}>
          <Icon icon={icon} className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-hi)]">{title}</h2>
          {description && <p className="text-xs text-[var(--text-lo)]">{description}</p>}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}
