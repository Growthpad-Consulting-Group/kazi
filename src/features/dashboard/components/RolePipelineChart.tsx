"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type RolePipeline = {
  role: string;
  applied: number;
  screened: number;
  interview: number;
  offer: number;
};

const STAGES = [
  { key: "applied", label: "Applied", color: "#94a3b8" },
  { key: "screened", label: "Screened", color: "#60a5fa" },
  { key: "interview", label: "Interview", color: "#a78bfa" },
  { key: "offer", label: "Offer", color: "#fbbf24" },
] as const;

export default function RolePipelineChart({ data }: { data: RolePipeline[] }) {
  if (!data.length)
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-[var(--text-lo)]">
        No active role pipeline yet.
      </div>
    );

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 8, left: 12, bottom: 0 }}
        barCategoryGap="22%"
      >
        <CartesianGrid
          horizontal={false}
          stroke="var(--border)"
          strokeOpacity={0.55}
        />
        <XAxis
          type="number"
          allowDecimals={false}
          axisLine={false}
          tickLine={false}
          tick={{ fill: "var(--text-lo)", fontSize: 10 }}
        />
        <YAxis
          type="category"
          dataKey="role"
          width={120}
          axisLine={false}
          tickLine={false}
          tick={{ fill: "var(--text-lo)", fontSize: 10 }}
          tickFormatter={(name) =>
            name.length > 19 ? `${name.slice(0, 19)}…` : name
          }
        />
        <Tooltip
          cursor={{ fill: "var(--surface-2)" }}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text-hi)",
            fontSize: 12,
          }}
        />
        <Legend
          iconType="circle"
          iconSize={7}
          wrapperStyle={{
            fontSize: 10,
            color: "var(--text-lo)",
            paddingTop: 10,
          }}
        />
        {STAGES.map((stage) => (
          <Bar
            key={stage.key}
            dataKey={stage.key}
            name={stage.label}
            stackId="pipeline"
            fill={stage.color}
            radius={stage.key === "offer" ? [0, 5, 5, 0] : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
