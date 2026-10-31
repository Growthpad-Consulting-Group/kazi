"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface Props {
  surveyId: string;
  questions: {
    id: string;
    text: string;
    type: "scale" | "text" | "choice" | "quiz";
    options?: string[];
    time_limit_seconds?: number;
    required?: boolean;
  }[];
}

export function SurveyResponseForm({
  surveyId,
  questions,
  randomizeQuestions = false,
  followUpPrompt,
}: Props & { randomizeQuestions?: boolean; followUpPrompt?: string | null }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const displayQuestions = useMemo(
    () =>
      randomizeQuestions
        ? [...questions].sort(() => Math.random() - 0.5)
        : questions,
    [questions, randomizeQuestions],
  );
  const quizLimit = questions
    .filter((question) => question.type === "quiz")
    .reduce((sum, question) => sum + (question.time_limit_seconds ?? 60), 0);
  const [secondsLeft, setSecondsLeft] = useState(quizLimit);

  useEffect(() => {
    fetch(`/api/pulse/surveys/draft?surveyId=${encodeURIComponent(surveyId)}`)
      .then((response) => (response.ok ? response.json() : { answers: {} }))
      .then((data) => {
        setAnswers(data.answers ?? {});
        setDraftLoaded(true);
      })
      .catch(() => setDraftLoaded(true));
  }, [surveyId]);
  useEffect(() => {
    if (!quizLimit || secondsLeft <= 0) return;
    const timer = window.setInterval(
      () => setSecondsLeft((current) => Math.max(0, current - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [quizLimit, secondsLeft]);

  async function saveDraft() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/pulse/surveys/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surveyId, answers }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save draft");
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    if (quizLimit && secondsLeft <= 0) {
      setError("The quiz time has ended. Your response cannot be submitted.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/pulse/surveys/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surveyId, answers }),
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
      {displayQuestions.map((q) => (
        <div key={q.id}>
          <p className="mb-2 text-sm font-medium text-[var(--text-hi)]">
            {q.text}{" "}
            {q.required === false && (
              <span className="font-normal text-[var(--text-lo)]">
                Optional
              </span>
            )}
          </p>
          {q.type === "scale" ? (
            <div className="flex flex-wrap items-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setAnswers({ ...answers, [q.id]: n })}
                  className={`h-10 w-10 rounded-xl text-sm font-semibold transition-colors ${answers[q.id] === n ? "bg-brand-500 text-white shadow-sm" : "bg-[var(--surface-2)] text-[var(--text-lo)] hover:bg-brand-500/10 hover:text-brand-500"}`}
                >
                  {n}
                </button>
              ))}
              <span className="ml-1 self-center text-xs text-[var(--text-lo)]">
                1 = Strongly disagree · 5 = Strongly agree
              </span>
            </div>
          ) : q.type === "choice" || q.type === "quiz" ? (
            <>
              {q.type === "quiz" && (
                <p className="mb-2 text-[11px] font-medium text-brand-500">
                  Quiz question · {q.time_limit_seconds ?? 60}s suggested limit
                </p>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                {(q.options ?? []).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setAnswers({ ...answers, [q.id]: option })}
                    className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${answers[q.id] === option ? "border-brand-500 bg-brand-500/[0.08] font-semibold text-brand-600" : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-hi)] hover:border-brand-500/30"}`}
                  >
                    <span
                      className={`mr-2 inline-flex h-4 w-4 rounded-full border align-[-2px] ${answers[q.id] === option ? "border-brand-500 bg-brand-500 shadow-[inset_0_0_0_3px_var(--surface-2)]" : "border-[var(--text-lo)]/40"}`}
                    />
                    {option}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <textarea
              rows={3}
              value={(answers[q.id] as string) ?? ""}
              onChange={(e) =>
                setAnswers({ ...answers, [q.id]: e.target.value })
              }
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10"
            />
          )}
        </div>
      ))}
      {followUpPrompt && (
        <div>
          <p className="mb-2 text-sm font-medium text-[var(--text-hi)]">
            {followUpPrompt}{" "}
            <span className="font-normal text-[var(--text-lo)]">Optional</span>
          </p>
          <textarea
            rows={3}
            value={(answers._follow_up as string) ?? ""}
            onChange={(event) =>
              setAnswers({ ...answers, _follow_up: event.target.value })
            }
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm"
          />
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      {quizLimit > 0 && (
        <p
          className={`rounded-xl px-3 py-2 text-xs font-semibold ${secondsLeft <= 60 ? "bg-red-500/10 text-red-600" : "bg-sky-500/10 text-sky-700"}`}
        >
          Quiz time remaining: {Math.floor(secondsLeft / 60)}:
          {String(secondsLeft % 60).padStart(2, "0")}
        </p>
      )}

      <div className="border-t border-[var(--border)] pt-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            loading={saving}
            disabled={!draftLoaded}
            onClick={saveDraft}
          >
            Save draft
          </Button>
          <Button
            icon="solar:check-circle-broken"
            loading={saving}
            onClick={submit}
          >
            {saving ? "Submitting" : "Submit response"}
          </Button>
        </div>
      </div>
    </div>
  );
}
