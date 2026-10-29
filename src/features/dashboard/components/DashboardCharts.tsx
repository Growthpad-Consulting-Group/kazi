"use client";

import dynamic from "next/dynamic";
import { Icon } from "@iconify/react";

const ApplicationsTrendChart = dynamic(
  () => import("./ApplicationsTrendChart"),
  {
    ssr: false,
    loading: () => (
      <div className="h-40 animate-pulse rounded-xl bg-[var(--surface-2)]" />
    ),
  },
);
const RolePipelineChart = dynamic(() => import("./RolePipelineChart"), {
  ssr: false,
  loading: () => (
    <div className="h-[260px] animate-pulse rounded-xl bg-[var(--surface-2)]" />
  ),
});
const TeamPulseTrendChart = dynamic(() => import("./TeamPulseTrendChart"), {
  ssr: false,
  loading: () => (
    <div className="h-[260px] animate-pulse rounded-xl bg-[var(--surface-2)]" />
  ),
});

interface Props {
  trend: { day: string; count: number }[];
  rolePipeline: {
    role: string;
    applied: number;
    screened: number;
    interview: number;
    offer: number;
  }[];
  teamPulseTrend: { week: string; checkins: number; mood: number | null }[];
}

export default function DashboardCharts({
  trend,
  rolePipeline,
  teamPulseTrend,
}: Props) {
  const trendTotal = trend.reduce((a, b) => a + b.count, 0);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Applications trend */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/50 hover:shadow-2xl dark:shadow-black/20 p-5 transition-shadow duration-200">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/15">
              <Icon
                icon="solar:chart-broken"
                className="h-3.5 w-3.5 text-brand-500"
              />
            </div>
            <div>
              <h2 className="text-md font-semibold text-[var(--text-hi)]">
                Application activity
              </h2>
              <p className="text-[11px] text-[var(--text-lo)]">
                Candidates who applied in the selected period
              </p>
            </div>
          </div>
          <span className="font-mono text-lg font-bold text-brand-500">
            {trendTotal}
          </span>
        </div>
        <ApplicationsTrendChart data={trend} />
      </div>

      {/* Applications trend */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 transition-shadow duration-200 hover:shadow-2xl dark:shadow-black/20">
        <div className="mb-3 flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
            <Icon
              icon="solar:sort-vertical-broken"
              className="h-3.5 w-3.5 text-brand-500"
            />
          </div>
          <div>
            <h2 className="text-md font-semibold text-[var(--text-hi)]">
              Pipeline by role
            </h2>
            <p className="text-[11px] text-[var(--text-lo)]">
              Where candidates are concentrated
            </p>
          </div>
        </div>
        <RolePipelineChart data={rolePipeline} />
      </div>

      <div className="lg:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 transition-shadow duration-200 hover:shadow-2xl dark:shadow-black/20">
        <div className="mb-3 flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
            <Icon
              icon="solar:heart-pulse-broken"
              className="h-3.5 w-3.5 text-brand-500"
            />
          </div>
          <div>
            <h2 className="text-md font-semibold text-[var(--text-hi)]">
              Team pulse trend
            </h2>
            <p className="text-[11px] text-[var(--text-lo)]">
              Check-in participation and average mood
            </p>
          </div>
        </div>
        <TeamPulseTrendChart data={teamPulseTrend} />
      </div>
    </div>
  );
}
