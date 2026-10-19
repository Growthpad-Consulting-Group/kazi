"use client";

import dynamic from "next/dynamic";
import { Icon } from "@iconify/react";

const ApplicationsTrendChart = dynamic(
  () => import("./ApplicationsTrendChart"),
  { ssr: false, loading: () => <div className="h-40 animate-pulse rounded-xl bg-[var(--surface-2)]" /> }
);
const PipelineDonutChart = dynamic(
  () => import("./PipelineDonutChart"),
  { ssr: false, loading: () => <div className="h-40 animate-pulse rounded-xl bg-[var(--surface-2)]" /> }
);

const STAGE_COLORS: Record<string, string> = {
  applied:   "#94a3b8",
  screened:  "#60a5fa",
  interview: "#a78bfa",
  offer:     "#fbbf24",
  hired:     "#4ade80",
};

interface Props {
  trend: { day: string; count: number }[];
  pipeline: { stage: string; count: number }[];
}

export default function DashboardCharts({ trend, pipeline }: Props) {
  const trendTotal = trend.reduce((a, b) => a + b.count, 0);
  const activePipeline = pipeline.filter((s) => s.stage !== "rejected" && s.count > 0);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

      {/* Applications trend */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#f05d23]/15">
              <Icon icon="solar:chart-broken" className="h-3.5 w-3.5 text-[#f05d23]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-hi)]">Applications (7 days)</h2>
              <p className="text-[11px] text-[var(--text-lo)]">Candidates who applied this week</p>
            </div>
          </div>
          <span className="font-mono text-lg font-bold text-[#f05d23]">{trendTotal}</span>
        </div>
        <ApplicationsTrendChart data={trend} />
      </div>

      {/* Pipeline donut */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-2 flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-500/15">
            <Icon icon="solar:pie-chart-broken" className="h-3.5 w-3.5 text-violet-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-hi)]">Pipeline Breakdown</h2>
            <p className="text-[11px] text-[var(--text-lo)]">Candidates by current stage</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <PipelineDonutChart data={pipeline} />
          </div>
          <div className="shrink-0 space-y-2">
            {activePipeline.map(({ stage, count }) => (
              <div key={stage} className="flex items-center gap-2">
                <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: STAGE_COLORS[stage] ?? "#94a3b8" }} />
                <span className="w-16 text-[11px] capitalize text-[var(--text-lo)]">{stage}</span>
                <span className="font-mono text-xs font-bold text-[var(--text-hi)]">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
