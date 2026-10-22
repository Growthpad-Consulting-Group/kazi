import type { Survey, SurveyResponse } from "@/types/database";
import { SurveyDistributionChart } from "./SurveyDistributionChart";

interface Props {
  survey: Survey;
  responses: SurveyResponse[];
}

export function SurveyResults({ survey, responses }: Props) {
  if (!responses.length) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3"><div><h2 className="text-sm font-semibold text-[var(--text-hi)]">Response insights</h2><p className="mt-0.5 text-xs text-[var(--text-lo)]">Based on {responses.length} respondent{responses.length !== 1 ? "s" : ""}</p></div><span className="rounded-lg bg-brand-500/10 px-2.5 py-1 font-mono text-xs font-bold text-brand-500">{responses.length}</span></div>

      {survey.questions.map((q) => {
        const qAnswers = responses
          .map((r) => r.answers[q.id])
          .filter((a) => a !== undefined && a !== "");

        if (!qAnswers.length) return null;

        if (q.type === "scale") {
          const nums = qAnswers.map(Number).filter((n) => !isNaN(n));
          const avg = Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10;
          const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
          nums.forEach((n) => { if (n >= 1 && n <= 5) dist[n]++; });
          const maxCount = Math.max(...Object.values(dist), 1);

          return (
            <div key={q.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/45 p-4 shadow-sm">
              <p className="mb-3 text-sm font-semibold text-[var(--text-hi)]">{q.text}</p>
              <div className="flex items-end gap-2 mb-3">
                <span className="font-mono text-3xl font-bold text-brand-500">{avg}</span>
                <span className="mb-1 text-sm text-[var(--text-lo)]">/5</span>
              </div>
              <SurveyDistributionChart data={[1, 2, 3, 4, 5].map((label) => ({ label: String(label), count: dist[label] }))} />
            </div>
          );
        }

        if (q.type === "choice") {
          const options = q.options ?? [];
          const counts = new Map(options.map((option) => [option, 0]));
          qAnswers.forEach((answer) => { if (typeof answer === "string" && counts.has(answer)) counts.set(answer, (counts.get(answer) ?? 0) + 1); });
          const total = [...counts.values()].reduce((sum, count) => sum + count, 0) || 1;
          return <div key={q.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/45 p-4 shadow-sm"><div className="mb-3 flex items-start justify-between gap-3"><p className="text-sm font-semibold text-[var(--text-hi)]">{q.text}</p><span className="rounded-md bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-lo)]">{q.type === "quiz" ? "Quiz" : "Poll"}</span></div><SurveyDistributionChart data={options.map((label) => ({ label, count: counts.get(label) ?? 0 }))} /></div>;
        }

        // Text responses
        const texts = qAnswers.filter((a) => typeof a === "string" && a.trim()) as string[];
        return (
          <div key={q.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/45 p-4">
            <p className="mb-3 text-sm font-semibold text-[var(--text-hi)]">{q.text}</p>
            <div className="space-y-2">
              {texts.map((t, i) => (
                <p key={i} className="border-l-2 border-brand-500/30 pl-3 text-sm text-[var(--text-lo)]">{t}</p>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
