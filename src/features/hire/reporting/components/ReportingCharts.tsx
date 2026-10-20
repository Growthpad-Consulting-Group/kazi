"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Icon } from "@iconify/react";

const STAGE_COLORS: Record<string, string> = { applied: "#94a3b8", screened: "#3b82f6", interview: "#06b6d4", offer: "#f59e0b", hired: "#22c55e", rejected: "#ef4444" };

interface Props {
  funnel: { stage: string; count: number }[];
  applications: { week: string; applications: number }[];
  sources: { source: string; applicants: number; shortlisted: number; avgScore: number | null }[];
}

const tooltipStyle = { borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-hi)", fontSize: 12 };

export function ReportingCharts({ funnel, applications, sources }: Props) {
  const activeFunnel = funnel.filter((item) => item.stage !== "rejected" && item.count > 0);
  const activeTotal = activeFunnel.reduce((sum, item) => sum + item.count, 0);
  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <ChartCard icon="solar:chart-square-broken" tone="orange" title="Application momentum" description="Incoming applications over the last eight weeks.">
        <ResponsiveContainer width="100%" height={235}>
          <AreaChart data={applications} margin={{ top: 12, right: 8, left: -24, bottom: 0 }}>
            <defs><linearGradient id="reportApplications" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#f05d23" stopOpacity={0.4} /><stop offset="100%" stopColor="#f05d23" stopOpacity={0.02} /></linearGradient></defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="week" tick={{ fill: "var(--text-lo)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: "var(--text-lo)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, "Applications"]} />
            <Area type="monotone" dataKey="applications" stroke="#f05d23" strokeWidth={3} fill="url(#reportApplications)" dot={{ r: 3, fill: "#f05d23", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#fff", stroke: "#f05d23", strokeWidth: 3 }} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard icon="solar:pie-chart-2-broken" tone="blue" title="Pipeline conversion" description="Distribution across the active hiring journey.">
        {activeTotal ? <div className="flex items-center gap-4"><div className="relative min-w-0 flex-1"><ResponsiveContainer width="100%" height={235}><PieChart><Pie data={activeFunnel} dataKey="count" nameKey="stage" innerRadius={62} outerRadius={88} paddingAngle={3} strokeWidth={0}>{activeFunnel.map((item) => <Cell key={item.stage} fill={STAGE_COLORS[item.stage]} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="font-mono text-2xl font-bold text-[var(--text-hi)]">{activeTotal}</span><span className="text-[10px] uppercase tracking-wide text-[var(--text-lo)]">active</span></div></div><div className="w-28 shrink-0 space-y-2">{activeFunnel.map((item) => <div key={item.stage} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: STAGE_COLORS[item.stage] }} /><span className="flex-1 text-xs capitalize text-[var(--text-lo)]">{item.stage}</span><span className="font-mono text-xs font-bold text-[var(--text-hi)]">{item.count}</span></div>)}</div></div> : <ChartEmpty text="Your active pipeline will appear here." />}
      </ChartCard>

      <div className="xl:col-span-2"><ChartCard icon="solar:ranking-broken" tone="green" title="Source quality" description="Applicants and shortlisted candidates by top source."><ResponsiveContainer width="100%" height={250}><BarChart data={sources} margin={{ top: 10, right: 8, left: -18, bottom: 0 }} barCategoryGap="28%"><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="source" tick={{ fill: "var(--text-lo)", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: "var(--text-lo)", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="applicants" name="Applicants" fill="#3b82f6" radius={[6, 6, 0, 0]} /><Bar dataKey="shortlisted" name="Shortlisted" fill="#f05d23" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard></div>
    </section>
  );
}

function ChartCard({ icon, tone, title, description, children }: { icon: string; tone: "orange" | "blue" | "green"; title: string; description: string; children: React.ReactNode }) {
  const tones = { orange: "bg-[#f05d23]/10 text-[#d94f1c]", blue: "bg-blue-500/10 text-blue-600", green: "bg-green-500/10 text-green-600" };
  return <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/30 transition-shadow duration-200 hover:shadow-2xl dark:shadow-black/20"><div className="mb-3 flex items-center gap-2.5"><span className={`flex h-8 w-8 items-center justify-center rounded-xl ${tones[tone]}`}><Icon icon={icon} className="h-4 w-4" /></span><div><h2 className="text-base font-semibold text-[var(--text-hi)]">{title}</h2><p className="text-[11px] text-[var(--text-lo)]">{description}</p></div></div>{children}</div>;
}

function ChartEmpty({ text }: { text: string }) { return <div className="flex h-[235px] items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-sm text-[var(--text-lo)]">{text}</div>; }
