"use client";

import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type PulsePoint = { week: string; checkins: number; mood: number | null };

export default function TeamPulseTrendChart({ data }: { data: PulsePoint[] }) {
  if (!data.length) return <div className="flex h-[260px] items-center justify-center text-sm text-[var(--text-lo)]">No check-in history yet.</div>;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="checkinGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.38} />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.65} />
        <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: "var(--text-lo)", fontSize: 10 }} />
        <YAxis yAxisId="checkins" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "var(--text-lo)", fontSize: 10 }} />
        <YAxis yAxisId="mood" orientation="right" domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} axisLine={false} tickLine={false} tick={{ fill: "var(--text-lo)", fontSize: 10 }} />
        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-hi)", fontSize: 12 }} />
        <Area yAxisId="checkins" type="monotone" dataKey="checkins" name="Check-ins" stroke="#22d3ee" strokeWidth={2.5} fill="url(#checkinGradient)" />
        <Line yAxisId="mood" type="monotone" dataKey="mood" name="Avg. mood" stroke="#fbbf24" strokeWidth={2.5} dot={{ r: 3, fill: "#fbbf24", strokeWidth: 0 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
