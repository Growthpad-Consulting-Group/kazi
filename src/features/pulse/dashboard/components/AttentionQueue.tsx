import Link from "next/link";
import { Icon } from "@iconify/react";
import type { AttentionItem } from "../manager-queue";
import { goHref } from "@/features/pulse/measurement";

const URGENCY: Record<
  AttentionItem["urgency"],
  { label: string; pill: string; icon: string }
> = {
  urgent: {
    label: "Urgent",
    pill: "bg-red-500/10 text-red-500",
    icon: "solar:danger-triangle-broken",
  },
  soon: {
    label: "Soon",
    pill: "bg-amber-500/15 text-amber-600",
    icon: "solar:clock-circle-broken",
  },
  neutral: {
    label: "Open",
    pill: "bg-[var(--surface-2)] text-[var(--text-lo)]",
    icon: "solar:inbox-broken",
  },
};

export default function AttentionQueue({ items }: { items: AttentionItem[] }) {
  return (
    <section
      aria-labelledby="attention-heading"
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
            <Icon icon="solar:bell-bing-broken" className="h-3.5 w-3.5" />
          </span>
          <h2
            id="attention-heading"
            className="text-sm font-semibold text-[var(--text-hi)]"
          >
            Needs attention
          </h2>
        </div>
        {items.length > 0 && (
          <span className="rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--text-lo)]">
            {items.length} open
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl bg-[var(--surface-2)] p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
            <Icon icon="solar:check-circle-broken" className="h-4 w-4" />
          </span>
          <p className="text-sm text-[var(--text-hi)]">
            Nothing needs your action right now.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {items.map((item) => {
            const urgency = URGENCY[item.urgency];
            return (
              <li
                key={item.id}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${urgency.pill}`}
                  >
                    <Icon icon={urgency.icon} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-hi)]">
                      {item.title}{" "}
                      <span
                        className={`ml-1 rounded-md px-1.5 py-0.5 align-middle text-[10px] font-semibold ${urgency.pill}`}
                      >
                        {urgency.label}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-lo)]">
                      {item.reason}
                    </p>
                  </div>
                </div>
                <Link
                  href={goHref("attention", item.id, item.href)}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold text-[var(--text-hi)] transition-colors hover:bg-[var(--surface)] sm:self-center"
                >
                  {item.actionLabel}
                  <Icon
                    icon="solar:arrow-right-broken"
                    className="h-3.5 w-3.5"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
