import { Icon } from "@iconify/react";
import type { ReactNode } from "react";

type ModalAsideItem = {
  icon: string;
  label: string;
  detail: string;
};

/**
 * Optional context rail for long, configuration-heavy modals.
 * It intentionally disappears below `lg`, leaving the form as the focus on
 * smaller screens.
 */
export function ModalAside({
  title,
  description,
  items = [],
  footer,
}: {
  title: string;
  description: string;
  items?: ModalAsideItem[];
  footer?: ReactNode;
}) {
  return (
    <aside className="relative hidden h-[calc(80vh-65px)] self-start overflow-hidden border-r border-[var(--border)] bg-gradient-to-br from-brand-500/[0.09] via-brand-500/[0.03] to-transparent px-6 pb-6 pt-4 lg:sticky lg:top-0 lg:flex lg:flex-col">
      <span className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-brand-500/10 blur-3xl" />
      <span className="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="relative">
        <h3 className="text-md font-semibold text-[var(--text-hi)]">{title}</h3>
        <p className="mt-2 text-xs leading-relaxed text-[var(--text-lo)]">
          {description}
        </p>
      </div>

      {items.length > 0 && (
        <div className="relative mt-7 space-y-4">
          {items.map((item) => (
            <div key={item.label} className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface)] text-brand-500 shadow-sm">
                <Icon icon={item.icon} className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--text-hi)]">
                  {item.label}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-lo)]">
                  {item.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {footer && <div className="relative mt-auto pt-6">{footer}</div>}
    </aside>
  );
}
