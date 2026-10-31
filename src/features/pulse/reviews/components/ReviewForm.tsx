"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/Button";
import type { PerformanceReview, ReviewType } from "@/types/database";

interface Props {
  review: PerformanceReview;
  cycleId: string;
  revieweeId: string;
  reviewType: ReviewType;
}

type Rating = { criterion: string; rating: number; comment: string };
export type CompetencyCriterion = {
  name: string;
  weight?: number;
  guidance?: string;
};

const DEFAULT_CRITERIA = [
  "Quality of work",
  "Communication",
  "Collaboration",
  "Initiative & ownership",
  "Growth & development",
];

export function ReviewForm({
  review,
  revieweeId,
  reviewType,
  criteria = DEFAULT_CRITERIA.map((name) => ({
    name,
    weight: 20,
    guidance: "",
  })),
}: Props & { criteria?: CompetencyCriterion[] }) {
  const [ratings, setRatings] = useState<Rating[]>(() =>
    criteria.map(({ name: criterion }) => {
      const existing = review.competency_ratings.find(
        (rating) => rating.criterion === criterion,
      );
      return {
        criterion,
        rating: existing?.rating ?? 3,
        comment: existing?.comment ?? "",
      };
    }),
  );
  const [strengths, setStrengths] = useState(review.strengths ?? "");
  const [developmentAreas, setDevelopmentAreas] = useState(
    review.development_areas ?? "",
  );
  const [aiDraft, setAiDraft] = useState(review.ai_draft ?? "");
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<"draft" | "submitted" | null>(null);
  const [error, setError] = useState("");

  const overallRating =
    Math.round(
      ratings.reduce(
        (sum, rating, index) =>
          sum + rating.rating * ((criteria[index]?.weight ?? 20) / 100),
        0,
      ) * 10,
    ) / 10;

  function updateRating(index: number, value: number) {
    setRatings((current) =>
      current.map((rating, itemIndex) =>
        itemIndex === index ? { ...rating, rating: value } : rating,
      ),
    );
  }

  function updateComment(index: number, value: string) {
    setRatings((current) =>
      current.map((rating, itemIndex) =>
        itemIndex === index ? { ...rating, comment: value } : rating,
      ),
    );
  }

  async function generateDraft() {
    setDrafting(true);
    setError("");
    try {
      const response = await fetch("/api/pulse/ai-review-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: review.id, revieweeId, reviewType }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      setAiDraft(json.draft);
      if (json.strengths) setStrengths(json.strengths);
      if (json.developmentAreas) setDevelopmentAreas(json.developmentAreas);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Draft failed");
    } finally {
      setDrafting(false);
    }
  }

  async function submit(isDraft: boolean) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/pulse/reviews/${review.id}`, {
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
      if (!response.ok) throw new Error((await response.json()).error);
      setSaved(isDraft ? "draft" : "submitted");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/45 p-3 sm:p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-[var(--text-hi)]">
              Competencies
            </h4>
            <p className="mt-0.5 text-xs text-[var(--text-lo)]">
              Score each area, then add context where it helps.
            </p>
          </div>
          <div className="inline-flex items-baseline gap-1 rounded-xl bg-brand-500/10 px-3 py-2">
            <span className="font-mono text-xl font-bold text-brand-500">
              {overallRating}
            </span>
            <span className="text-xs text-brand-500/70">/5 overall</span>
          </div>
        </div>
        <div className="space-y-3">
          {ratings.map((rating, index) => (
            <div
              key={rating.criterion}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-[var(--text-hi)]">
                  {rating.criterion}
                  {criteria[index]?.weight && (
                    <span className="ml-1.5 text-[11px] font-normal text-[var(--text-lo)]">
                      {criteria[index].weight}%
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-label={`Rate ${rating.criterion} ${value} out of 5`}
                      onClick={() => updateRating(index, value)}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold transition-all ${rating.rating === value ? "bg-brand-500 text-white shadow-sm" : "bg-[var(--surface-2)] text-[var(--text-lo)] hover:bg-brand-500/10 hover:text-brand-500"}`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              {criteria[index]?.guidance && (
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-lo)]">
                  {criteria[index].guidance}
                </p>
              )}
              <input
                value={rating.comment}
                onChange={(event) => updateComment(index, event.target.value)}
                placeholder="Add a short example or observation (optional)"
                className="mt-2.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-hi)] outline-none placeholder:text-[var(--text-lo)] focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
              <Icon icon="solar:magic-stick-3-broken" className="h-4 w-4" />
            </span>
            <div>
              <h4 className="text-sm font-semibold text-[var(--text-hi)]">
                Draft with AI
              </h4>
              <p className="text-[11px] text-[var(--text-lo)]">
                A starting point that you can edit before submitting.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            icon="solar:magic-stick-3-broken"
            loading={drafting}
            onClick={generateDraft}
          >
            {aiDraft ? "Regenerate" : "Generate draft"}
          </Button>
        </div>
        {aiDraft && (
          <textarea
            rows={5}
            value={aiDraft}
            onChange={(event) => setAiDraft(event.target.value)}
            className="mt-3 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10"
          />
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
            Key strengths
          </label>
          <textarea
            rows={4}
            value={strengths}
            onChange={(event) => setStrengths(event.target.value)}
            placeholder="What does this person do exceptionally well?"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-hi)] outline-none placeholder:text-[var(--text-lo)] focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
            Development areas
          </label>
          <textarea
            rows={4}
            value={developmentAreas}
            onChange={(event) => setDevelopmentAreas(event.target.value)}
            placeholder="Where can they grow? Be specific and constructive."
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-hi)] outline-none placeholder:text-[var(--text-lo)] focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10"
          />
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
      {saved && (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700">
          {saved === "submitted"
            ? "Review submitted successfully."
            : "Draft saved."}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border)] pt-4">
        <Button
          variant="secondary"
          loading={saving}
          onClick={() => submit(true)}
        >
          Save draft
        </Button>
        <Button
          icon="solar:check-circle-broken"
          loading={saving}
          onClick={() => submit(false)}
        >
          {saving ? "Submitting" : "Submit review"}
        </Button>
      </div>
    </div>
  );
}
