"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS: Record<string, string> = {
  applied: "#94a3b8",
  screened: "#60a5fa",
  interview: "#a78bfa",
  offer: "#fbbf24",
  hired: "#4ade80",
};

interface Props {
  data: { stage: string; count: number }[];
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number }[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#1a1c1f]/90 px-3 py-2 text-xs shadow-xl backdrop-blur-sm">
      <p className="font-medium capitalize text-white/70">{payload[0].name}</p>
      <p className="font-mono font-bold text-white">{payload[0].value}</p>
    </div>
  );
}

export default function PipelineDonutChart({ data }: Props) {
  const filtered = data.filter((d) => d.stage !== "rejected" && d.count > 0);
  const total = filtered.reduce((a, b) => a + b.count, 0);

  return (
    <div className="relative flex items-center justify-center">
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie
            data={filtered}
            dataKey="count"
            nameKey="stage"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={72}
            paddingAngle={3}
            strokeWidth={0}
          >
            {filtered.map((entry) => (
              <Cell
                key={entry.stage}
                fill={COLORS[entry.stage] ?? "#94a3b8"}
                style={{
                  filter: `drop-shadow(0 0 4px ${COLORS[entry.stage] ?? "#94a3b8"}60)`,
                }}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      {/* Center label */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-2xl font-bold text-white">{total}</span>
        <span className="text-[10px] text-white/40 uppercase tracking-widest">
          active
        </span>
      </div>
    </div>
  );
}
