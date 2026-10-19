"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface Props {
  data: { day: string; count: number }[];
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#1a1c1f]/90 px-3 py-2 text-xs shadow-xl backdrop-blur-sm">
      <p className="font-medium text-white/70">{label}</p>
      <p className="font-mono font-bold text-[#f05d23]">{payload[0].value} applications</p>
    </div>
  );
}

export default function ApplicationsTrendChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} barSize={24} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
        <XAxis
          dataKey="day"
          tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <Bar
          dataKey="count"
          fill="#f05d23"
          radius={[6, 6, 0, 0]}
          fillOpacity={0.9}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
