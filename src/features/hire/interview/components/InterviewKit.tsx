"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/Button";

interface Question { question: string; type: string; criterion: string; guidance: string; }
interface ScorecardAnswer { question: string; answer: string; score: number; }

interface Props {
  candidateId: string;
  candidateName: string;
  roleTitle: string;
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

const RECOMMENDATIONS = {
  hire: { label: "Strong hire", description: "Evidence is consistently strong.", tone: "border-emerald-500 bg-emerald-500 text-white" },
  maybe: { label: "Discuss", description: "Promising, with open questions.", tone: "border-amber-500 bg-amber-500 text-white" },
  no_hire: { label: "No hire", description: "Evidence does not meet the bar.", tone: "border-red-500 bg-red-500 text-white" },
} as const;

export function InterviewKit({ candidateId, candidateName, roleTitle, rubric, existingScorecard }: Props) {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, { answer: string; score: number }>>(
    existingScorecard ? Object.fromEntries(existingScorecard.questions.map((question, index) => [index, { answer: question.answer, score: question.score }])) : {}
  );
  const [recommendation, setRecommendation] = useState<keyof typeof RECOMMENDATIONS | "">(
    (existingScorecard?.recommendation as keyof typeof RECOMMENDATIONS | null) ?? ""
  );
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [genError, setGenError] = useState("");
  const submitted = Boolean(existingScorecard?.submitted_at);
  const displayQuestions: Question[] = existingScorecard?.questions.map((question) => ({ question: question.question, type: "", criterion: "", guidance: "" })) ?? questions;
  const scoredCount = displayQuestions.filter((_, index) => (answers[index]?.score ?? 0) > 0).length;
  const averageScore = useMemo(() => scoredCount ? (Object.values(answers).reduce((sum, answer) => sum + answer.score, 0) / scoredCount).toFixed(1) : null, [answers, scoredCount]);
  const readyToSubmit = displayQuestions.length > 0 && scoredCount === displayQuestions.length && Boolean(recommendation);

  async function generateQuestions() {
    setGenerating(true); setGenError("");
    try {
      const response = await fetch("/api/hire/candidates/interview-questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateId }) });
      const data = await response.json().catch(() => null) as { questions?: Question[]; error?: string } | null;
      if (!response.ok || !data?.questions?.length) throw new Error(data?.error ?? "Could not generate interview questions.");
      setQuestions(data.questions); setAnswers({});
    } catch (cause) { setGenError(cause instanceof Error ? cause.message : "Could not generate interview questions."); }
    finally { setGenerating(false); }
  }

  async function submitScorecard() {
    if (!readyToSubmit) return;
    const filled = displayQuestions.map((question, index) => ({ question: question.question, answer: answers[index]?.answer ?? "", score: answers[index]?.score ?? 0 }));
    setSubmitting(true); setSubmitError("");
    try {
      const response = await fetch("/api/hire/interview/scorecard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateId, questions: filled, recommendation }) });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Could not submit the scorecard.");
      router.refresh();
    } catch (cause) { setSubmitError(cause instanceof Error ? cause.message : "Could not submit the scorecard."); }
    finally { setSubmitting(false); }
  }

  if (submitted && existingScorecard) return <SubmittedScorecard candidateName={candidateName} scorecard={existingScorecard} />;

  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
    <main className="min-w-0 space-y-5">
      {displayQuestions.length === 0 ? <section className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-7"><div className="pointer-events-none absolute -right-12 -top-14 h-44 w-44 rounded-full bg-brand-500/10 blur-3xl" /><div className="relative max-w-2xl"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500"><Icon icon="solar:magic-stick-3-broken" className="h-5 w-5" /></span><p className="mt-5 text-xs font-semibold uppercase tracking-[.16em] text-brand-500">Interview preparation</p><h2 className="mt-2 text-xl font-semibold text-[var(--text-hi)]">Build a focused interview plan.</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-lo)]">Generate structured questions matched to the role and score each answer against the hiring rubric. Your scorecard stays private until you submit it.</p><div className="mt-6 flex flex-wrap items-center gap-3"><Button icon="solar:magic-stick-3-broken" loading={generating} onClick={generateQuestions}>{generating ? "Building your guide" : "Generate interview guide"}</Button><span className="text-xs text-[var(--text-lo)]">Usually takes a few seconds</span></div>{genError && <p className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600">{genError}</p>}</div></section> : <>
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#f05d23]">Live scorecard</p><h2 className="mt-1 text-lg font-semibold text-[var(--text-hi)]">Capture evidence, then decide.</h2><p className="mt-1 text-sm text-[var(--text-lo)]">Score every question before making your recommendation.</p></div><div className="rounded-xl bg-[var(--surface-2)] px-3 py-2 text-right"><p className="font-mono text-lg font-bold text-[var(--text-hi)]">{scoredCount}/{displayQuestions.length}</p><p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-lo)]">Scored</p></div></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]"><div className="h-full rounded-full bg-gradient-to-r from-[#f05d23] to-orange-400 transition-all" style={{ width: `${displayQuestions.length ? (scoredCount / displayQuestions.length) * 100 : 0}%` }} /></div></section>
        <div className="space-y-4">{displayQuestions.map((question, index) => <QuestionCard key={`${question.question}-${index}`} question={question} index={index} answer={answers[index]} onChange={(next) => setAnswers((current) => ({ ...current, [index]: next }))} />)}</div>
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"><div className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500"><Icon icon="solar:flag-broken" className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold text-[var(--text-hi)]">Overall recommendation</h2><p className="mt-1 text-xs text-[var(--text-lo)]">Choose based on the evidence you captured—not a gut feeling.</p></div></div><div className="mt-5 grid gap-2 sm:grid-cols-3">{(Object.keys(RECOMMENDATIONS) as (keyof typeof RECOMMENDATIONS)[]).map((key) => { const option = RECOMMENDATIONS[key]; const selected = recommendation === key; return <button key={key} type="button" onClick={() => setRecommendation(key)} className={`rounded-xl border p-3 text-left transition-all ${selected ? option.tone : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-hi)] hover:border-brand-500/35"}`}><p className="text-sm font-semibold">{option.label}</p><p className={`mt-1 text-xs ${selected ? "text-white/75" : "text-[var(--text-lo)]"}`}>{option.description}</p></button>; })}</div><div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4"><p className="text-xs text-[var(--text-lo)]">{readyToSubmit ? "Ready to submit your scorecard." : `Score all ${displayQuestions.length} questions and choose a recommendation to submit.`}</p><Button icon="solar:check-circle-broken" loading={submitting} disabled={!readyToSubmit} onClick={submitScorecard}>{submitting ? "Submitting" : "Submit scorecard"}</Button></div>{submitError && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-600">{submitError}</p>}</section>
      </>}
    </main>
    <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start"><section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--text-lo)]">Interviewing</p><h2 className="mt-2 text-lg font-semibold text-[var(--text-hi)]">{candidateName}</h2><p className="mt-1 text-sm text-[var(--text-lo)]">{roleTitle}</p><div className="mt-5 grid grid-cols-2 gap-2"><div className="rounded-xl bg-[var(--surface-2)] p-3"><p className="font-mono text-xl font-bold text-brand-500">{rubric.length || "—"}</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-lo)]">Criteria</p></div><div className="rounded-xl bg-[var(--surface-2)] p-3"><p className="font-mono text-xl font-bold text-[var(--text-hi)]">{averageScore ?? "—"}</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-lo)]">Average</p></div></div></section><section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500"><Icon icon="solar:clipboard-check-broken" className="h-3.5 w-3.5" /></span><h2 className="text-sm font-semibold text-[var(--text-hi)]">Rubric focus</h2></div>{rubric.length ? <div className="mt-4 space-y-2">{rubric.map((item) => <div key={item.criterion} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--surface-2)] px-3 py-2"><span className="min-w-0 truncate text-xs font-medium text-[var(--text-hi)]">{item.criterion}</span><span className="font-mono text-[10px] text-[var(--text-lo)]">{item.weight}%</span></div>)}</div> : <p className="mt-4 text-sm text-[var(--text-lo)]">No scoring rubric is attached to this role.</p>}</section></aside>
  </div>;
}

function QuestionCard({ question, index, answer, onChange }: { question: Question; index: number; answer?: { answer: string; score: number }; onChange: (value: { answer: string; score: number }) => void }) {
  const score = answer?.score ?? 0;
  return <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"><div className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 font-mono text-xs font-bold text-brand-500">{String(index + 1).padStart(2, "0")}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2"><span className="rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-lo)]">{question.type || "Structured"}</span>{question.criterion && <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600">{question.criterion}</span>}</div><h3 className="mt-2 text-sm font-semibold leading-6 text-[var(--text-hi)]">{question.question}</h3>{question.guidance && <p className="mt-2 text-xs leading-5 text-[var(--text-lo)]"><span className="font-semibold text-brand-500">Listen for: </span>{question.guidance}</p>}</div></div><div className="mt-5 grid gap-4 border-t border-[var(--border)] pt-4 lg:grid-cols-[minmax(0,1fr)_auto]"><label className="block"><span className="text-xs font-semibold text-[var(--text-hi)]">Evidence &amp; notes</span><textarea rows={3} value={answer?.answer ?? ""} onChange={(event) => onChange({ answer: event.target.value, score })} placeholder="Capture the answer, examples, and signals you heard…" className="mt-2 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-hi)] outline-none placeholder:text-[var(--text-lo)] focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10" /></label><div><p className="text-xs font-semibold text-[var(--text-hi)]">Score</p><div className="mt-2 flex gap-1.5">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" title={`${value} out of 5`} onClick={() => onChange({ answer: answer?.answer ?? "", score: value })} className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold transition-all ${score === value ? "bg-brand-500 text-white shadow-sm shadow-brand-500/25" : "bg-[var(--surface-2)] text-[var(--text-lo)] hover:bg-brand-500/10 hover:text-brand-500"}`}>{value}</button>)}</div><p className="mt-2 text-[10px] text-[var(--text-lo)]">1 = weak · 5 = exceptional</p></div></div></section>;
}

function SubmittedScorecard({ candidateName, scorecard }: { candidateName: string; scorecard: NonNullable<Props["existingScorecard"]> }) {
  const recommendation = scorecard.recommendation as keyof typeof RECOMMENDATIONS | null;
  const meta = recommendation ? RECOMMENDATIONS[recommendation] : null;
  return <div className="space-y-5"><section className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-[var(--surface)] p-6 shadow-sm"><div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" /><div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600"><Icon icon="solar:check-circle-broken" className="h-5 w-5" /></span><div><p className="text-sm font-semibold text-[var(--text-hi)]">Scorecard submitted</p><p className="mt-1 text-xs text-[var(--text-lo)]">Your interview feedback for {candidateName} is now in the hiring decision.</p></div></div><div className="flex items-center gap-3"><span className="font-mono text-3xl font-bold text-[var(--text-hi)]">{scorecard.overall_score ?? "—"}<span className="text-sm font-medium text-[var(--text-lo)]">/5</span></span>{meta && <span className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${meta.tone}`}>{meta.label}</span>}</div></div></section>{scorecard.ai_summary && <section className="rounded-2xl border border-blue-500/15 bg-blue-500/5 p-5"><div className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600"><Icon icon="solar:magic-stick-3-broken" className="h-4 w-4" /></span><div><p className="text-sm font-semibold text-blue-700">Scorecard summary</p><p className="mt-2 text-sm leading-6 text-[var(--text-hi)]">{scorecard.ai_summary}</p></div></div></section>}<section className="space-y-3">{scorecard.questions.map((question, index) => <div key={`${question.question}-${index}`} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"><div className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-2)] font-mono text-xs font-bold text-[var(--text-lo)]">{String(index + 1).padStart(2, "0")}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-4"><h3 className="text-sm font-semibold text-[var(--text-hi)]">{question.question}</h3><span className="shrink-0 rounded-lg bg-brand-500/10 px-2 py-1 font-mono text-xs font-bold text-brand-500">{question.score}/5</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--text-lo)]">{question.answer || "No notes captured."}</p></div></div></div>)}</section></div>;
}
