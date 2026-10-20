"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Question {
  question: string;
  type: string;
  criterion: string;
  guidance: string;
}

interface ScorecardAnswer {
  question: string;
  answer: string;
  score: number;
}

interface Props {
  candidateId: string;
  rubric: { criterion: string; weight: number }[];
  existingScorecard: {
    id: string;
    questions: ScorecardAnswer[];
    overall_score: number | null;
    recommendation: string | null;
    ai_summary: string | null;
    submitted_at: string | null;
  } | null;
}

export function InterviewKit({ candidateId, rubric, existingScorecard }: Props) {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, { answer: string; score: number }>>(
    existingScorecard
      ? Object.fromEntries(
          existingScorecard.questions.map((q, i) => [i, { answer: q.answer, score: q.score }])
        )
      : {}
  );
  const [recommendation, setRecommendation] = useState<"hire" | "maybe" | "no_hire" | "">(
    (existingScorecard?.recommendation as "hire" | "maybe" | "no_hire" | null) ?? ""
  );
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [genError, setGenError] = useState("");
  const submitted = !!existingScorecard?.submitted_at;

  // Use existing questions from scorecard if already submitted
  const displayQuestions: Question[] =
    existingScorecard?.questions.map((q) => ({
      question: q.question,
      type: "",
      criterion: "",
      guidance: "",
    })) ?? questions;

  async function generateQuestions() {
    setGenerating(true);
    setGenError("");
    try {
      const res = await fetch("/api/hire/candidates/interview-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setQuestions(json.questions);
      setAnswers({});
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Failed to generate");
    } finally {
      setGenerating(false);
    }
  }

  async function submitScorecard() {
    const activeQuestions = displayQuestions;
    if (!activeQuestions.length) return;

    const filled: ScorecardAnswer[] = activeQuestions.map((q, i) => ({
      question: q.question,
      answer: answers[i]?.answer ?? "",
      score: answers[i]?.score ?? 0,
    }));

    const totalScore = filled.reduce((sum, a) => sum + a.score, 0) / filled.length;

    setSubmitting(true);
    setSubmitError("");
    try {
      // Written through the API route: the interviewer id comes from the
      // session server-side, and the route invalidates the candidate's cache.
      const res = await fetch("/api/hire/interview/scorecard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId,
          questions: filled,
          recommendation,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to submit scorecard");
      router.refresh();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to submit scorecard");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Generate button */}
      {!submitted && displayQuestions.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">AI-Generated Questions</h2>
          <p className="text-sm text-slate-500 mb-4">
            Claude will generate role-specific questions based on the job requirements and
            candidate&apos;s CV. Tailored to the scoring rubric.
          </p>
          {genError && <p className="text-xs text-red-500 mb-3">{genError}</p>}
          <button
            onClick={generateQuestions}
            disabled={generating}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {generating ? "Generating…" : "Generate Interview Questions"}
          </button>
        </div>
      )}

      {/* Questions + answers */}
      {displayQuestions.length > 0 && (
        <div className="space-y-4">
          {displayQuestions.map((q, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="flex items-start gap-3 mb-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">{q.question}</p>
                  {q.type && (
                    <div className="flex gap-2 mt-1">
                      <span className="text-xs text-slate-400 capitalize">{q.type}</span>
                      {q.criterion && (
                        <span className="text-xs text-blue-500">· {q.criterion}</span>
                      )}
                    </div>
                  )}
                  {q.guidance && (
                    <p className="text-xs text-slate-400 italic mt-1">
                      Strong answer: {q.guidance}
                    </p>
                  )}
                </div>
              </div>

              {!submitted ? (
                <div className="space-y-2 pl-9">
                  <textarea
                    rows={3}
                    placeholder="Notes from candidate's answer…"
                    value={answers[i]?.answer ?? ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [i]: { ...prev[i], answer: e.target.value, score: prev[i]?.score ?? 3 },
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">Score:</span>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() =>
                          setAnswers((prev) => ({
                            ...prev,
                            [i]: { ...prev[i], score: n, answer: prev[i]?.answer ?? "" },
                          }))
                        }
                        className={`w-7 h-7 rounded-full text-xs font-semibold transition-colors ${
                          (answers[i]?.score ?? 0) === n
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="pl-9 space-y-1">
                  <p className="text-sm text-slate-600">
                    {existingScorecard?.questions[i]?.answer || (
                      <span className="text-slate-400 italic">No notes</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">
                    Score: <strong>{existingScorecard?.questions[i]?.score ?? "—"}</strong>/5
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Recommendation + submit */}
      {displayQuestions.length > 0 && !submitted && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow duration-200 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Overall Recommendation</h2>
          <div className="flex gap-2">
            {(["hire", "maybe", "no_hire"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRecommendation(r)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  recommendation === r
                    ? r === "hire"
                      ? "bg-green-600 text-white"
                      : r === "no_hire"
                      ? "bg-red-600 text-white"
                      : "bg-amber-500 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {r === "hire" ? "Hire" : r === "maybe" ? "Maybe" : "No Hire"}
              </button>
            ))}
          </div>
          <button
            onClick={submitScorecard}
            disabled={submitting || !recommendation}
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40 transition-colors"
          >
            {submitting ? "Submitting…" : "Submit Scorecard"}
          </button>
          {submitError && (
            <p className="text-sm text-red-600">{submitError}</p>
          )}
        </div>
      )}

      {/* Submitted summary */}
      {submitted && existingScorecard && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-slate-900">
              {existingScorecard.overall_score ?? "—"}
              <span className="text-sm font-normal text-slate-400">/5</span>
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                existingScorecard.recommendation === "hire"
                  ? "bg-green-100 text-green-700"
                  : existingScorecard.recommendation === "no_hire"
                  ? "bg-red-100 text-red-600"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {existingScorecard.recommendation === "hire"
                ? "Hire"
                : existingScorecard.recommendation === "no_hire"
                ? "No Hire"
                : "Maybe"}
            </span>
            <span className="text-xs text-slate-400">
              Submitted{" "}
              {new Date(existingScorecard.submitted_at!).toLocaleDateString("en-KE", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          {existingScorecard.ai_summary && (
            <p className="mt-3 text-sm text-slate-600">{existingScorecard.ai_summary}</p>
          )}
        </div>
      )}
    </div>
  );
}
