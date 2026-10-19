import type { Survey, SurveyResponse } from "@/types/database";

interface Props {
  survey: Survey;
  responses: SurveyResponse[];
}

export function SurveyResults({ survey, responses }: Props) {
  if (!responses.length) return null;

  return (
    <div className="space-y-5">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
        Results · {responses.length} respondent{responses.length !== 1 ? "s" : ""}
      </h2>

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
            <div key={q.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <p className="text-sm font-semibold text-slate-900 mb-3">{q.text}</p>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-3xl font-bold text-slate-900">{avg}</span>
                <span className="text-slate-400 text-sm mb-1">/5</span>
              </div>
              <div className="flex items-end gap-1.5 h-16">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-blue-500 rounded-t transition-all" style={{ height: `${(dist[n] / maxCount) * 52}px` }} />
                    <span className="text-xs text-slate-400">{n}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        // Text responses
        const texts = qAnswers.filter((a) => typeof a === "string" && a.trim()) as string[];
        return (
          <div key={q.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <p className="text-sm font-semibold text-slate-900 mb-3">{q.text}</p>
            <div className="space-y-2">
              {texts.map((t, i) => (
                <p key={i} className="text-sm text-slate-600 border-l-2 border-slate-200 pl-3">{t}</p>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
