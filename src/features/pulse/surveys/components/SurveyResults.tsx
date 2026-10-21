import type { Survey, SurveyResponse } from "@/types/database";

interface Props {
  survey: Survey;
  responses: SurveyResponse[];
}

export function SurveyResults({ survey, responses }: Props) {
  if (!responses.length) return null;

  return (
    <div className="space-y-5">
      <div><h2 className="text-sm font-semibold text-[var(--text-hi)]">Survey results</h2><p className="mt-0.5 text-xs text-[var(--text-lo)]">Based on {responses.length} respondent{responses.length !== 1 ? "s" : ""}</p></div>

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
            <div key={q.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/45 p-4">
              <p className="mb-3 text-sm font-semibold text-[var(--text-hi)]">{q.text}</p>
              <div className="flex items-end gap-2 mb-2">
                <span className="font-mono text-3xl font-bold text-[#f05d23]">{avg}</span>
                <span className="mb-1 text-sm text-[var(--text-lo)]">/5</span>
              </div>
              <div className="flex items-end gap-1.5 h-16">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t bg-gradient-to-t from-[#f05d23] to-orange-400 transition-all" style={{ height: `${(dist[n] / maxCount) * 52}px` }} />
                    <span className="text-xs text-[var(--text-lo)]">{n}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        // Text responses
        const texts = qAnswers.filter((a) => typeof a === "string" && a.trim()) as string[];
        return (
          <div key={q.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/45 p-4">
            <p className="mb-3 text-sm font-semibold text-[var(--text-hi)]">{q.text}</p>
            <div className="space-y-2">
              {texts.map((t, i) => (
                <p key={i} className="border-l-2 border-[#f05d23]/30 pl-3 text-sm text-[var(--text-lo)]">{t}</p>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
