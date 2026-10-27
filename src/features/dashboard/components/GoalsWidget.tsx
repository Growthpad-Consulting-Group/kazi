"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Icon } from "@iconify/react";

const GoalsDonutChart = dynamic(() => import("./GoalsDonutChart"), {
  ssr: false,
  loading: () => <div className="h-[160px] animate-pulse rounded-xl bg-[var(--surface-2)]" />,
});

interface Props {
  onTrack: number;
  atRisk: number;
  completed: number;
  notStarted: number;
}

export default function GoalsWidget({ onTrack, atRisk, completed, notStarted }: Props) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
            <Icon icon="solar:target-broken" className="h-3.5 w-3.5 text-brand-500" />
          </div>
          <div>
            <h2 className="text-md font-semibold text-[var(--text-hi)]">Goals</h2>
            <p className="text-[11px] text-[var(--text-lo)]">Org-wide progress</p>
          </div>
        </div>
        <Link href="/pulse/goals" className="text-xs text-brand-500 hover:underline">View all</Link>
      </div>
      <GoalsDonutChart
        onTrack={onTrack}
        atRisk={atRisk}
        completed={completed}
        notStarted={notStarted}
      />
    </section>
  );
}
