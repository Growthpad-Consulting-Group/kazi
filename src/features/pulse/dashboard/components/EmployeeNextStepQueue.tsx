import Link from "next/link";
import { Icon } from "@iconify/react";
import type { NextStep } from "../next-steps";
import { goHref } from "@/features/pulse/measurement";

const KIND_ICON: Record<NextStep["kind"], string> = {
  review_acknowledgement: "solar:document-text-broken",
  daily_log: "solar:notebook-broken",
  weekly_checkin: "solar:clipboard-check-broken",
  survey: "solar:list-check-broken",
  side_quest: "solar:flag-broken",
  wall_of_fame: "solar:cup-star-broken",
  one_on_one_prep: "solar:chat-round-dots-broken",
  action_items: "solar:checklist-minimalistic-broken",
};

const TONE_PILL: Record<NextStep["tone"], string> = {
  urgent: "bg-amber-500/15 text-amber-600",
  soon: "bg-blue-500/10 text-blue-600",
  neutral: "bg-[var(--surface)] text-[var(--text-lo)]",
};

export default function EmployeeNextStepQueue({
  steps,
}: {
  steps: NextStep[];
}) {
  const [primary, ...rest] = steps;

  return (
    <section
      aria-labelledby="next-step-heading"
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6"
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
          <Icon icon="solar:bolt-broken" className="h-3.5 w-3.5" />
        </span>
        <h2
          id="next-step-heading"
          className="text-sm font-semibold text-[var(--text-hi)]"
        >
          Your next step
        </h2>
      </div>

      {!primary ? (
        <div className="flex items-center gap-3 rounded-xl bg-[var(--surface-2)] p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
            <Icon icon="solar:check-circle-broken" className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-[var(--text-hi)]">
              You&apos;re all caught up
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-lo)]">
              Nothing needs your attention right now.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4 rounded-xl border border-brand-500/20 bg-brand-500/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                <Icon icon={KIND_ICON[primary.kind]} className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <span
                  className={`inline-flex rounded-md px-1.5 py-0.5 text-xs font-semibold ${TONE_PILL[primary.tone]}`}
                >
                  {primary.urgency}
                </span>
                <p className="mt-1.5 text-sm font-semibold text-[var(--text-hi)]">
                  {primary.title}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-lo)]">
                  {primary.description}
                </p>
              </div>
            </div>
            <Link
              href={goHref("employee", primary.kind, primary.href)}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-brand-500/20 transition-colors hover:bg-brand-600"
            >
              {primary.actionLabel}
              <Icon icon="solar:arrow-right-broken" className="h-3.5 w-3.5" />
            </Link>
          </div>

          {rest.length > 0 && (
            <ul className="mt-3 divide-y divide-[var(--border)]">
              {rest.map((step) => (
                <li key={step.kind}>
                  <Link
                    href={goHref("employee", step.kind, step.href)}
                    className="group flex items-center justify-between gap-3 py-3 transition-colors hover:text-brand-500"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <Icon
                        icon={KIND_ICON[step.kind]}
                        className="h-4 w-4 shrink-0 text-[var(--text-lo)]"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-[var(--text-hi)]">
                          {step.title}
                        </span>
                        <span className="block truncate text-xs text-[var(--text-lo)]">
                          {step.urgency}
                        </span>
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
          )}
        </>
      )}
    </section>
  );
}
