"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import type { PerformanceReview } from "@/types/database";

export function FinalReviewFeedback({ review }: { review: PerformanceReview }) {
  const router = useRouter();
  const [response, setResponse] = useState(
    (review as PerformanceReview & { employee_response?: string | null })
      .employee_response ?? "",
  );
  const [acknowledged, setAcknowledged] = useState(
    Boolean(
      (
        review as PerformanceReview & {
          employee_acknowledged_at?: string | null;
        }
      ).employee_acknowledged_at,
    ),
  );
  const [saving, setSaving] = useState(false);
  const [creatingPlan, setCreatingPlan] = useState(false);

  async function createPlan() {
    setCreatingPlan(true);
    try {
      const result = await fetch("/api/pulse/idps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: review.reviewee_id,
          title: "Development plan from performance review",
          goals: review.development_areas ?? "",
          start_date: null,
          due_date: null,
        }),
      });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error);
      toast.success("Development plan created.");
      router.push(`/pulse/idps/${data.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not create a development plan.",
      );
    } finally {
      setCreatingPlan(false);
    }
  }

  async function acknowledge() {
    setSaving(true);
    try {
      const result = await fetch(
        `/api/pulse/reviews/${review.id}/acknowledgement`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ response }),
        },
      );
      const data = await result.json();
      if (!result.ok) throw new Error(data.error);
      setAcknowledged(true);
      toast.success("Review acknowledged.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not acknowledge review.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-hi)]">
            Final feedback
          </h2>
          <p className="mt-1 text-xs text-[var(--text-lo)]">
            Manager feedback released after the review cycle closed.
          </p>
        </div>
        {review.overall_rating && (
          <span className="rounded-xl bg-brand-500/10 px-3 py-2 font-mono text-sm font-bold text-brand-500">
            {review.overall_rating}/5
          </span>
        )}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-[var(--surface-2)] p-3">
          <p className="text-xs font-semibold text-[var(--text-hi)]">
            Key strengths
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-lo)]">
            {review.strengths || "No written strengths provided."}
          </p>
        </div>
        <div className="rounded-xl bg-[var(--surface-2)] p-3">
          <p className="text-xs font-semibold text-[var(--text-hi)]">
            Development focus
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-lo)]">
            {review.development_areas ||
              "No written development areas provided."}
          </p>
        </div>
      </div>
      <label className="mt-4 block text-xs font-semibold text-[var(--text-hi)]">
        Your response{" "}
        <span className="font-normal text-[var(--text-lo)]">Optional</span>
        <textarea
          value={response}
          disabled={acknowledged}
          onChange={(event) => setResponse(event.target.value)}
          maxLength={2000}
          rows={3}
          className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm font-normal text-[var(--text-hi)] outline-none focus:border-brand-500"
          placeholder="Add context or confirm what you will do next…"
        />
      </label>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Link
          href={`/pulse/checkins?user=${review.reviewee_id}`}
          className="inline-flex items-center rounded-lg bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold text-[var(--text-hi)] transition-colors hover:bg-[var(--border)]"
        >
          View check-ins
        </Link>
        <Link
          href={`/pulse/goals?user=${review.reviewee_id}`}
          className="inline-flex items-center rounded-lg bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold text-[var(--text-hi)] transition-colors hover:bg-[var(--border)]"
        >
          View goals
        </Link>
        <Link
          href={`/pulse/one-on-ones?report=${review.reviewee_id}`}
          className="inline-flex items-center rounded-lg bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold text-[var(--text-hi)] transition-colors hover:bg-[var(--border)]"
        >
          1-on-1s
        </Link>
        {review.development_areas && (
          <Button
            variant="secondary"
            loading={creatingPlan}
            onClick={createPlan}
          >
            Create development plan
          </Button>
        )}
        <Button loading={saving} disabled={acknowledged} onClick={acknowledge}>
          {acknowledged ? "Acknowledged" : "Acknowledge feedback"}
        </Button>
      </div>
    </section>
  );
}
