"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  onTrack: number;
  atRisk: number;
  completed: number;
  notStarted: number;
}

const SLICES = [
  { key: "onTrack", label: "On track", color: "#60a5fa" },
  { key: "atRisk", label: "At risk", color: "#f87171" },
  { key: "completed", label: "Completed", color: "#4ade80" },
  { key: "notStarted", label: "Not started", color: "#94a3b8" },
] as const;

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text-hi)",
  fontSize: 12,
};

export default function GoalsDonutChart({
  onTrack,
  atRisk,
  completed,
  notStarted,
}: Props) {
  const values = { onTrack, atRisk, completed, notStarted };
  const total = onTrack + atRisk + completed + notStarted;

  const data = SLICES.map((s) => ({
    name: s.label,
    value: values[s.key],
    color: s.color,
  })).filter((d) => d.value > 0);

  if (total === 0) {
    return (
      <div className="flex h-[160px] items-center justify-center text-sm text-[var(--text-lo)]">
        No goals yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Donut */}
      <div className="relative">
        <ResponsiveContainer width={140} height={140}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={44}
              outerRadius={64}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value, name) => [value, name]}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Centre label */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-2xl font-bold text-[var(--text-hi)]">
            {total}
          </span>
          <span className="text-[10px] text-[var(--text-lo)]">goals</span>
        </div>
      </div>

      {/* Legend */}
      <div className="w-full space-y-1.5">
        {SLICES.map((s) => {
          const val = values[s.key];
          const pct = total > 0 ? Math.round((val / total) * 100) : 0;
          return (
            <div key={s.key} className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="flex-1 text-xs text-[var(--text-lo)]">
                {s.label}
              </span>
              <span className="font-mono text-xs font-bold text-[var(--text-hi)]">
                {val}
              </span>
              <span className="w-7 text-right font-mono text-[10px] text-[var(--text-lo)]">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
