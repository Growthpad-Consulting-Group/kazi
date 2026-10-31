import dynamic from "next/dynamic";
import type { Survey, SurveyResponse } from "@/types/database";
const SurveyDistributionChart = dynamic(
  () =>
    import("./SurveyDistributionChart").then((m) => m.SurveyDistributionChart),
  {
    loading: () => (
      <div className="h-72 animate-pulse rounded-2xl bg-[var(--surface-2)]" />
    ),
  },
);

interface Props {
  survey: Survey;
  responses: SurveyResponse[];
  showTextResponses?: boolean;
  segments?: { department: string; count: number }[];
}

export function SurveyResults({
  survey,
  responses,
  showTextResponses = false,
  segments = [],
}: Props) {
  if (!responses.length) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-hi)]">
            Response insights
          </h2>
          <p className="mt-0.5 text-xs text-[var(--text-lo)]">
            Based on {responses.length} respondent
            {responses.length !== 1 ? "s" : ""}
          </p>
        </div>
        <span className="rounded-lg bg-brand-500/10 px-2.5 py-1 font-mono text-xs font-bold text-brand-500">
          {responses.length}
        </span>
      </div>
      {segments.length > 0 && (
        <div className="rounded-xl bg-[var(--surface-2)] p-3">
          <p className="text-xs font-semibold text-[var(--text-hi)]">
            Anonymous participation by department
          </p>
          <p className="mt-1 text-[11px] text-[var(--text-lo)]">
            Only groups with at least five responses are shown.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {segments.map((segment) => (
              <span
                key={segment.department}
                className="rounded-lg bg-[var(--surface)] px-2 py-1 text-xs"
              >
                {segment.department} · {segment.count}
              </span>
            ))}
          </div>
        </div>
      )}

      {survey.questions.map((q) => {
        const qAnswers = responses
          .map((r) => r.answers[q.id])
          .filter((a) => a !== undefined && a !== "");

        if (!qAnswers.length) return null;

        if (q.type === "scale") {
          const nums = qAnswers.map(Number).filter((n) => !isNaN(n));
          const avg =
            Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) /
            10;
          const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
          nums.forEach((n) => {
            if (n >= 1 && n <= 5) dist[n]++;
          });
          return (
            <div
              key={q.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/45 p-4 shadow-sm"
            >
              <p className="mb-3 text-sm font-semibold text-[var(--text-hi)]">
                {q.text}
              </p>
              <div className="flex items-end gap-2 mb-3">
                <span className="font-mono text-3xl font-bold text-brand-500">
                  {avg}
                </span>
                <span className="mb-1 text-sm text-[var(--text-lo)]">/5</span>
              </div>
              <SurveyDistributionChart
                data={[1, 2, 3, 4, 5].map((label) => ({
                  label: String(label),
                  count: dist[label],
                }))}
              />
            </div>
          );
        }

        if (q.type === "choice" || q.type === "quiz") {
          const options = q.options ?? [];
          const counts = new Map(options.map((option) => [option, 0]));
          qAnswers.forEach((answer) => {
            if (typeof answer === "string" && counts.has(answer))
              counts.set(answer, (counts.get(answer) ?? 0) + 1);
          });
          return (
            <div
              key={q.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/45 p-4 shadow-sm"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--text-hi)]">
                  {q.text}
                </p>
                <span className="rounded-md bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-lo)]">
                  {q.type === "quiz" ? "Quiz" : "Poll"}
                </span>
              </div>
              <SurveyDistributionChart
                data={options.map((label) => ({
                  label,
                  count: counts.get(label) ?? 0,
                }))}
              />
            </div>
          );
        }

        // Qualitative answers can identify a respondent through their wording,
        // so only survey administrators can inspect the raw comments.
        if (!showTextResponses)
          return (
            <div
              key={q.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/45 p-4"
            >
              <p className="text-sm font-semibold text-[var(--text-hi)]">
                {q.text}
              </p>
              <p className="mt-2 text-xs text-[var(--text-lo)]">
                Open-text responses are available to the people team for
                follow-up.
              </p>
            </div>
          );
        const texts = qAnswers.filter(
          (a) => typeof a === "string" && a.trim(),
        ) as string[];
        return (
          <div
            key={q.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/45 p-4"
          >
            <p className="mb-3 text-sm font-semibold text-[var(--text-hi)]">
              {q.text}
            </p>
            <div className="space-y-2">
              {texts.map((t, i) => (
                <p
                  key={i}
                  className="border-l-2 border-brand-500/30 pl-3 text-sm text-[var(--text-lo)]"
                >
                  {t}
                </p>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
