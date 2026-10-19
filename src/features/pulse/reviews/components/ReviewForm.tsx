"use client";

import { useState } from "react";
import type { PerformanceReview, ReviewType } from "@/types/database";

interface Props {
  review: PerformanceReview;
  cycleId: string;
  revieweeId: string;
  reviewType: ReviewType;
}

type Rating = { criterion: string; rating: number; comment: string };

const DEFAULT_CRITERIA = [
  "Quality of work",
  "Communication",
  "Collaboration",
  "Initiative & ownership",
  "Growth & development",
];

export function ReviewForm({ review, cycleId, revieweeId, reviewType }: Props) {
  const initialRatings: Rating[] = DEFAULT_CRITERIA.map((c) => {
    const existing = review.competency_ratings.find((r) => r.criterion === c);
    return { criterion: c, rating: existing?.rating ?? 3, comment: existing?.comment ?? "" };
  });

  const [ratings, setRatings] = useState<Rating[]>(initialRatings);
  const [strengths, setStrengths] = useState(review.strengths ?? "");
  const [developmentAreas, setDevelopmentAreas] = useState(review.development_areas ?? "");
  const [aiDraft, setAiDraft] = useState(review.ai_draft ?? "");
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const overallRating = Math.round((ratings.reduce((s, r) => s + r.rating, 0) / ratings.length) * 10) / 10;

  function setRating(i: number, val: number) {
    setRatings(ratings.map((r, idx) => idx === i ? { ...r, rating: val } : r));
  }

  function setComment(i: number, val: string) {
    setRatings(ratings.map((r, idx) => idx === i ? { ...r, comment: val } : r));
  }

  async function generateDraft() {
    setDrafting(true);
    setError("");
    try {
      const res = await fetch("/api/pulse/ai-review-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: review.id, revieweeId, reviewType }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setAiDraft(json.draft);
      if (json.strengths) setStrengths(json.strengths);
      if (json.developmentAreas) setDevelopmentAreas(json.developmentAreas);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Draft failed");
    } finally {
      setDrafting(false);
    }
  }

  async function submit(isDraft: boolean) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/pulse/reviews/${review.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competency_ratings: ratings,
          overall_rating: overallRating,
          strengths,
          development_areas: developmentAreas,
          ai_draft: aiDraft,
          submitted_at: isDraft ? null : new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Competency ratings */}
      <div className="space-y-4">
        {ratings.map((r, i) => (
          <div key={r.criterion}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-slate-700">{r.criterion}</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setRating(i, n)}
                    className={`w-7 h-7 rounded-full text-xs font-semibold transition-colors ${r.rating === n ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <input
              value={r.comment}
              onChange={(e) => setComment(i, e.target.value)}
              placeholder="Brief comment (optional)…"
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 py-1">
        <span className="text-xs text-slate-500">Overall rating:</span>
        <span className="text-lg font-bold text-slate-900">{overallRating}</span>
        <span className="text-xs text-slate-400">/5</span>
      </div>

      {/* AI draft */}
      <div className="rounded-lg bg-violet-50 border border-violet-100 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-violet-700">AI Draft (edit before submitting)</p>
          <button onClick={generateDraft} disabled={drafting} className="rounded-lg bg-violet-600 px-3 py-1 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors">
            {drafting ? "Generating…" : aiDraft ? "Regenerate" : "Generate Draft"}
          </button>
        </div>
        {aiDraft && (
          <textarea rows={4} value={aiDraft} onChange={(e) => setAiDraft(e.target.value)}
            className="w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
        )}
      </div>

      {/* Strengths & development */}
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Key strengths</label>
        <textarea rows={2} value={strengths} onChange={(e) => setStrengths(e.target.value)}
          placeholder="What does this person do exceptionally well?"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Development areas</label>
        <textarea rows={2} value={developmentAreas} onChange={(e) => setDevelopmentAreas(e.target.value)}
          placeholder="Where can they grow? Be specific and constructive."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
      {saved && <p className="text-xs text-green-600">Saved.</p>}

      <div className="flex gap-2">
        <button onClick={() => submit(true)} disabled={saving} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">
          Save draft
        </button>
        <button onClick={() => submit(false)} disabled={saving} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition-colors">
          {saving ? "Submitting…" : "Submit review"}
        </button>
      </div>
    </div>
  );
}
