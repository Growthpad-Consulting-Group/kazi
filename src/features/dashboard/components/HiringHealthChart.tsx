"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type StageAge = { stage: string; count: number; averageDays: number };
const STAGE_LABELS: Record<string, string> = {
  applied: "Applied",
  screened: "Screened",
  interview: "Interview",
  offer: "Offer",
};
const STAGE_COLORS: Record<string, string> = {
  applied: "#94a3b8",
  screened: "#60a5fa",
  interview: "#a78bfa",
  offer: "#fbbf24",
};

export default function HiringHealthChart({
  stages,
  stalled,
  averageDays,
}: {
  stages: StageAge[];
  stalled: number;
  averageDays: number | null;
}) {
  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-3xl font-bold text-brand-500">
            {averageDays ?? "—"}
            <span className="ml-1 text-xs font-medium text-[var(--text-lo)]">
              days
            </span>
          </p>
          <p className="mt-1 text-[10px] text-[var(--text-lo)]">
            average time to hire
          </p>
        </div>
        <div
          className={`rounded-xl px-2.5 py-1.5 text-right ${stalled ? "bg-amber-500/10" : "bg-green-500/10"}`}
        >
          <p
            className={`font-mono text-sm font-bold ${stalled ? "text-amber-500" : "text-green-500"}`}
          >
            {stalled}
          </p>
          <p className="text-[9px] text-[var(--text-lo)]">stalled 14+ days</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={116}>
        <BarChart
          data={stages}
          layout="vertical"
          margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
          barCategoryGap="30%"
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="stage"
            width={64}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--text-lo)", fontSize: 10 }}
            tickFormatter={(stage) => STAGE_LABELS[stage] ?? stage}
          />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              fontSize: 11,
            }}
            formatter={(value, _name, item) => [
              `${value} days · ${item.payload.count} candidates`,
              "Avg. in pipeline",
            ]}
          />
          <Bar dataKey="averageDays" radius={[0, 5, 5, 0]}>
            {stages.map((entry) => (
              <Cell
                key={entry.stage}
                fill={STAGE_COLORS[entry.stage] ?? "#94a3b8"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-1 text-[10px] text-[var(--text-lo)]">
        Average days in pipeline by current stage
      </p>
    </div>
  );
}
