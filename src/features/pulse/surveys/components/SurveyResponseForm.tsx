"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  surveyId: string;
  questions: { id: string; text: string; type: "scale" | "text" }[];
  respondentId: string | null;
}

export function SurveyResponseForm({ surveyId, questions, respondentId }: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/pulse/surveys/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surveyId, answers, respondentId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {questions.map((q) => (
        <div key={q.id}>
          <p className="text-sm font-medium text-slate-700 mb-2">{q.text}</p>
          {q.type === "scale" ? (
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setAnswers({ ...answers, [q.id]: n })}
                  className={`w-10 h-10 rounded-xl text-sm font-semibold transition-colors ${answers[q.id] === n ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                  {n}
                </button>
              ))}
              <span className="self-center text-xs text-slate-400 ml-1">1 = Strongly disagree · 5 = Strongly agree</span>
            </div>
          ) : (
            <textarea rows={3} value={(answers[q.id] as string) ?? ""}
              onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
          )}
        </div>
      ))}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button onClick={submit} disabled={saving} className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition-colors">
        {saving ? "Submitting…" : "Submit response"}
      </button>
    </div>
  );
}
