import Link from "next/link";
import { Icon } from "@iconify/react";

type StageRow = { stage: string; count: number };
type StageAge = { stage: string; count: number; averageDays: number };

const STAGE_LABELS: Record<string, string> = {
  applied: "Applied",
  screened: "Screened",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
};
const STAGE_COLORS: Record<string, string> = {
  applied: "bg-slate-400",
  screened: "bg-blue-400",
  interview: "bg-violet-400",
  offer: "bg-amber-400",
  hired: "bg-emerald-400",
};
const ORDER = ["applied", "screened", "interview", "offer", "hired"];

export default function PipelineOverview({
  pipeline,
  stages,
  stalled,
  averageDays,
}: {
  pipeline: StageRow[];
  stages: StageAge[];
  stalled: number;
  averageDays: number | null;
}) {
  const rows = ORDER.map((stage) => ({
    stage,
    count: pipeline.find((item) => item.stage === stage)?.count ?? 0,
    averageDays:
      stages.find((item) => item.stage === stage)?.averageDays ?? null,
  }));
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const max = Math.max(...rows.map((row) => row.count), 1);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-3xl font-bold text-[var(--text-hi)]">
            {total}
          </p>
          <p className="mt-1 text-[11px] text-[var(--text-lo)]">
            Active candidates · avg {averageDays ?? "—"} days to hire
          </p>
        </div>
        <span
          className={`rounded-xl px-2.5 py-1.5 text-right ${stalled ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600"}`}
        >
          <span className="block font-mono text-sm font-bold">{stalled}</span>
          <span className="block text-[10px]">stalled</span>
        </span>
      </div>

      <ul className="mt-5 space-y-3">
        {rows.map((row) => (
          <li key={row.stage}>
            <Link
              href={`/hire/candidates?stage=${row.stage}`}
              className="group block rounded-lg px-1 py-1 transition-colors hover:bg-[var(--surface-2)]"
            >
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="flex items-center gap-2 text-[var(--text-hi)]">
                  <span
                    className={`h-2 w-2 rounded-full ${STAGE_COLORS[row.stage]}`}
                  />
                  {STAGE_LABELS[row.stage]}
                </span>
                <span className="font-mono text-[var(--text-lo)]">
                  {row.averageDays !== null
                    ? `${row.averageDays}d in stage · `
                    : ""}
                  <span className="font-bold text-[var(--text-hi)]">
                    {row.count}
                  </span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                <div
                  className={`h-full rounded-full ${STAGE_COLORS[row.stage]} transition-all duration-700`}
                  style={{ width: `${(row.count / max) * 100}%` }}
                />
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <Link
        href="/hire/pipeline"
        className="mt-auto flex items-center gap-1 pt-4 text-xs font-semibold text-brand-500 hover:underline"
      >
        Open pipeline{" "}
        <Icon icon="solar:arrow-right-broken" className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
