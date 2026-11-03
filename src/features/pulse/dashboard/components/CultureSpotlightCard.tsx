import Link from "next/link";
import { Icon } from "@iconify/react";
import type { CultureSpotlight } from "../culture-spotlight";

const KIND_ICON: Record<CultureSpotlight["kind"], string> = {
  recognition: "solar:star-fall-broken",
  reward: "solar:gift-broken",
};

export default function CultureSpotlightCard({
  spotlight,
}: {
  spotlight: CultureSpotlight;
}) {
  return (
    <Link
      href={spotlight.href}
      className="group flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] px-5 py-4 transition-colors hover:bg-emerald-500/10"
    >
      <span className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600">
          <Icon icon={KIND_ICON[spotlight.kind]} className="h-4 w-4" />
        </span>
        <span>
          <span className="block text-sm font-semibold text-[var(--text-hi)]">
            {spotlight.title}
          </span>
          <span className="block text-xs text-[var(--text-lo)]">
            {spotlight.description}
          </span>
        </span>
      </span>
      <span className="hidden shrink-0 items-center gap-1 text-xs font-semibold text-emerald-600 sm:inline-flex">
        {spotlight.actionLabel}
        <Icon
          icon="solar:arrow-right-broken"
          className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
        />
      </span>
    </Link>
  );
}
