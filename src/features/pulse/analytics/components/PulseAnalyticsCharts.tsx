"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Icon } from "@iconify/react";

type TrendPoint = {
  week: string;
  label: string;
  rate: number;
  mood: number | null;
};
type GoalBucket = { status: string; count: number };

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text-hi)",
  fontSize: 12,
};
const GOAL_COLORS: Record<string, string> = {
  not_started: "#94a3b8",
  in_progress: "#3b82f6",
  at_risk: "#f59e0b",
  completed: "#22c55e",
};
const GOAL_LABELS: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  at_risk: "At risk",
  completed: "Completed",
};

export function PulseAnalyticsCharts({
  trend,
  goals,
}: {
  trend: TrendPoint[];
  goals: GoalBucket[];
}) {
  const totalGoals = goals.reduce((total, item) => total + item.count, 0);
  const activeGoalData = goals.filter((item) => item.count > 0);

  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <ChartCard
        icon="solar:graph-up-broken"
        tone="orange"
        title="Team rhythm"
        description="Check-in participation and average mood over the last four weeks."
      >
        <ResponsiveContainer width="100%" height={255}>
          <AreaChart
            data={trend}
            margin={{ top: 14, right: 8, left: -22, bottom: 0 }}
          >
            <defs>
              <linearGradient id="analyticsCheckin" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#f05d23" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#f05d23" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="var(--border)"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--text-lo)", fontSize: 10 }}
            />
            <YAxis
              yAxisId="rate"
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--text-lo)", fontSize: 10 }}
            />
            <YAxis
              yAxisId="mood"
              orientation="right"
              domain={[0, 5]}
              ticks={[1, 2, 3, 4, 5]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--text-lo)", fontSize: 10 }}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value, name) => [
                name === "Check-in rate" ? `${value}%` : `${value}/5`,
                name,
              ]}
            />
            <Area
              yAxisId="rate"
              type="monotone"
              dataKey="rate"
              name="Check-in rate"
              stroke="#f05d23"
              strokeWidth={3}
              fill="url(#analyticsCheckin)"
              dot={{ r: 3, fill: "#f05d23", strokeWidth: 0 }}
              activeDot={{
                r: 5,
                fill: "#fff",
                stroke: "#f05d23",
                strokeWidth: 3,
              }}
            />
            <Area
              yAxisId="mood"
              type="monotone"
              dataKey="mood"
              name="Average mood"
              stroke="#3b82f6"
              strokeWidth={2.5}
              fill="none"
              dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        icon="solar:pie-chart-2-broken"
        tone="blue"
        title="Goal health"
        description={`${totalGoals} goal${totalGoals === 1 ? "" : "s"} currently tracked.`}
      >
        {totalGoals ? (
          <div className="flex items-center gap-4">
            <div className="relative min-w-0 flex-1">
              <ResponsiveContainer width="100%" height={255}>
                <PieChart>
                  <Pie
                    data={activeGoalData}
                    dataKey="count"
                    nameKey="status"
                    innerRadius={64}
                    outerRadius={90}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {activeGoalData.map((item) => (
                      <Cell
                        key={item.status}
                        fill={GOAL_COLORS[item.status] ?? "#94a3b8"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value, _name, item) => [
                      value,
                      GOAL_LABELS[item.payload.status] ?? item.payload.status,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-2xl font-bold text-[var(--text-hi)]">
                  {totalGoals}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-[var(--text-lo)]">
                  goals
                </span>
              </div>
            </div>
            <div className="w-32 shrink-0 space-y-2.5">
              {goals.map((item) => (
                <div key={item.status} className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: GOAL_COLORS[item.status] ?? "#94a3b8",
                    }}
                  />
                  <span className="flex-1 text-xs text-[var(--text-lo)]">
                    {GOAL_LABELS[item.status] ?? item.status}
                  </span>
                  <span className="font-mono text-xs font-bold text-[var(--text-hi)]">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <ChartEmpty text="Goals will appear here once your team starts tracking them." />
        )}
      </ChartCard>
    </section>
  );
}

function ChartCard({
  icon,
  tone,
  title,
  description,
  children,
}: {
  icon: string;
  tone: "orange" | "blue";
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const colors =
    tone === "orange"
      ? "bg-brand-500/10 text-brand-500"
      : "bg-blue-500/10 text-blue-600";
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/30 dark:shadow-black/20">
      <div className="mb-3 flex items-center gap-2.5">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-xl ${colors}`}
        >
          <Icon icon={icon} className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-hi)]">
            {title}
          </h2>
          <p className="text-[11px] text-[var(--text-lo)]">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function ChartEmpty({ text }: { text: string }) {
  return (
    <div className="flex h-[255px] items-center justify-center rounded-xl border border-dashed border-[var(--border)] px-6 text-center text-sm text-[var(--text-lo)]">
      {text}
    </div>
  );
}
