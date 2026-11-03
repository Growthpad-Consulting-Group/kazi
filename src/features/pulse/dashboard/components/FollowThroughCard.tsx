import Link from "next/link";
import { Icon } from "@iconify/react";
import type { FollowThroughItem } from "../follow-through-rank";

export default function FollowThroughCard({
  items,
  total,
}: {
  items: FollowThroughItem[];
  total: number;
}) {
  return (
    <section
      aria-labelledby="follow-through-heading"
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
            <Icon
              icon="solar:checklist-minimalistic-broken"
              className="h-3.5 w-3.5"
            />
          </span>
          <h2
            id="follow-through-heading"
            className="text-sm font-semibold text-[var(--text-hi)]"
          >
            Your commitments
          </h2>
        </div>
        {total > 0 && (
          <span className="rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--text-lo)]">
            {total} open
          </span>
        )}
      </div>

      {items.length ? (
        <ul className="divide-y divide-[var(--border)]">
          {items.map((entry) => (
            <li key={entry.id}>
              <Link
                href={entry.href}
                className="group flex items-center justify-between gap-3 py-3 transition-colors hover:text-brand-500"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-[var(--text-hi)]">
                    {entry.text}
                  </span>
                  <span className="block truncate text-xs text-[var(--text-lo)]">
                    {entry.source}
                    {entry.dueAt
                      ? ` · Due ${entry.dueAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}`
                      : ""}
                  </span>
                </span>
                <Icon
                  icon="solar:arrow-right-broken"
                  className="h-3.5 w-3.5 shrink-0 text-[var(--text-lo)] transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[var(--text-lo)]">
          No open commitments. Items from your 1-on-1s and development plan will
          appear here.
        </p>
      )}
    </section>
  );
}
