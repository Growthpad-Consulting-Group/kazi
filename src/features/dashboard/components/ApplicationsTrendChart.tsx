"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface Props {
  data: { day: string; count: number }[];
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#1a1c1f]/90 px-3 py-2 text-xs shadow-xl backdrop-blur-sm">
      <p className="font-medium text-white/70">{label}</p>
      <p className="font-mono font-bold text-brand-500">
        {payload[0].value} applications
      </p>
    </div>
  );
}

export default function ApplicationsTrendChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart
        data={data}
        margin={{ top: 8, right: 4, left: -24, bottom: 0 }}
      >
        <defs>
          <linearGradient id="applicationsGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#f05d23" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#f05d23" stopOpacity={0.02} />
          </linearGradient>
        </defs>
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
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#f05d23"
          strokeWidth={3}
          fill="url(#applicationsGradient)"
          dot={{ r: 3, fill: "#f05d23", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#fff", stroke: "#f05d23", strokeWidth: 3 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
