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
const RolePipelineChart = dynamic(
  () => import("./RolePipelineChart"),
  { ssr: false, loading: () => <div className="h-[260px] animate-pulse rounded-xl bg-[var(--surface-2)]" /> }
);
const TeamPulseTrendChart = dynamic(
  () => import("./TeamPulseTrendChart"),
  { ssr: false, loading: () => <div className="h-[260px] animate-pulse rounded-xl bg-[var(--surface-2)]" /> }
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
  rolePipeline: { role: string; applied: number; screened: number; interview: number; offer: number }[];
  teamPulseTrend: { week: string; checkins: number; mood: number | null }[];
}

export default function DashboardCharts({ trend, pipeline, rolePipeline, teamPulseTrend }: Props) {
  const trendTotal = trend.reduce((a, b) => a + b.count, 0);
  const activePipeline = pipeline.filter((s) => s.stage !== "rejected" && s.count > 0);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

      {/* Applications trend */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/50 hover:shadow-2xl dark:shadow-black/20 p-5 transition-shadow duration-200">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#f05d23]/15">
              <Icon icon="solar:chart-broken" className="h-3.5 w-3.5 text-[#f05d23]" />
            </div>
            <div>
              <h2 className="text-md font-semibold text-[var(--text-hi)]">Application activity</h2>
              <p className="text-[11px] text-[var(--text-lo)]">Candidates who applied in the selected period</p>
            </div>
          </div>
          <span className="font-mono text-lg font-bold text-[#f05d23]">{trendTotal}</span>
        </div>
        <ApplicationsTrendChart data={trend} />
      </div>

      {/* Pipeline donut */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/50 hover:shadow-2xl dark:shadow-black/20 p-5 transition-shadow duration-200">
        <div className="mb-2 flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-500/15">
            <Icon icon="solar:pie-chart-broken" className="h-3.5 w-3.5 text-violet-500" />
          </div>
          <div>
            <h2 className="text-md font-semibold text-[var(--text-hi)]">Pipeline Breakdown</h2>
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

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 transition-shadow duration-200 hover:shadow-2xl dark:shadow-black/20">
        <div className="mb-3 flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-500/15"><Icon icon="solar:sort-vertical-broken" className="h-3.5 w-3.5 text-blue-500" /></div>
          <div><h2 className="text-md font-semibold text-[var(--text-hi)]">Pipeline by role</h2><p className="text-[11px] text-[var(--text-lo)]">Where candidates are concentrated</p></div>
        </div>
        <RolePipelineChart data={rolePipeline} />
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 transition-shadow duration-200 hover:shadow-2xl dark:shadow-black/20">
        <div className="mb-3 flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-cyan-500/15"><Icon icon="solar:heart-pulse-broken" className="h-3.5 w-3.5 text-cyan-500" /></div>
          <div><h2 className="text-md font-semibold text-[var(--text-hi)]">Team pulse trend</h2><p className="text-[11px] text-[var(--text-lo)]">Check-in participation and average mood</p></div>
        </div>
        <TeamPulseTrendChart data={teamPulseTrend} />
      </div>

    </div>
  );
}
