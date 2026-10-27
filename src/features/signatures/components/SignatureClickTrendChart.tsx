"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type TrendPoint = { label: string; clicks: number };

const tooltipStyle = { borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-hi)", fontSize: 12 };

export function SignatureClickTrendChart({ data }: { data: TrendPoint[] }) {
  return <ResponsiveContainer width="100%" height={238}><AreaChart data={data} margin={{ top: 14, right: 8, left: -22, bottom: 0 }}><defs><linearGradient id="signatureClickTrend" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#f05d23" stopOpacity={0.34} /><stop offset="100%" stopColor="#f05d23" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--text-lo)", fontSize: 10 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "var(--text-lo)", fontSize: 10 }} /><Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, "Clicks"]} /><Area type="monotone" dataKey="clicks" stroke="#f05d23" strokeWidth={3} fill="url(#signatureClickTrend)" dot={{ r: 3, fill: "#f05d23", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#fff", stroke: "#f05d23", strokeWidth: 3 }} /></AreaChart></ResponsiveContainer>;
}
