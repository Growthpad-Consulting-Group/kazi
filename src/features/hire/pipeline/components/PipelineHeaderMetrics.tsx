"use client";

import { Button } from "@/components/ui/Button";

interface Props {
  candidates: number;
  awaitingReview: number;
  interviews: number;
  offers: number;
}

export function PipelineHeaderMetrics({ candidates, awaitingReview, interviews, offers }: Props) {
  const metrics = [
    { label: "In process", value: candidates, target: "applied", tone: "text-[var(--text-hi)]", background: "bg-[var(--surface-2)] hover:bg-[var(--border)]" },
    { label: "To review", value: awaitingReview, target: "applied", tone: "text-brand-600", background: "bg-brand-500/10 hover:bg-brand-500/15" },
    { label: "Interviews", value: interviews, target: "interview", tone: "text-cyan-700", background: "bg-cyan-500/10 hover:bg-cyan-500/15" },
    { label: "Offers", value: offers, target: "offer", tone: "text-amber-700", background: "bg-amber-500/10 hover:bg-amber-500/15" },
  ];

  return (
    <div className="hidden items-center gap-1 lg:flex" aria-label="Pipeline summary">
      {metrics.map((metric) => (
        <Button
          key={metric.label}
          variant="ghost"
          size="sm"
          className={`h-8 whitespace-nowrap px-2.5 text-[11px] ${metric.background}`}
          onClick={() => document.getElementById(`pipeline-${metric.target}`)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })}
        >
          <span className={`font-mono font-bold ${metric.tone}`}>{metric.value}</span>
          <span>{metric.label}</span>
        </Button>
      ))}
    </div>
  );
}
