"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createJob, updateJob } from "../actions";
import type { Job, JobFormData, RubricItem } from "../types";

interface Props {
  job?: Job;
}

const EMPTY_RUBRIC: RubricItem = { criterion: "", weight: 20, description: "" };

export function JobForm({ job }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(job?.title ?? "");
  const [department, setDepartment] = useState(job?.department ?? "");
  const [location, setLocation] = useState(job?.location ?? "");
  const [description, setDescription] = useState(job?.description ?? "");
  const [mustHaves, setMustHaves] = useState<string[]>(job?.requirements?.must_haves ?? [""]);
  const [niceToHaves, setNiceToHaves] = useState<string[]>(job?.requirements?.nice_to_haves ?? [""]);
  const [rubric, setRubric] = useState<RubricItem[]>(
    job?.scoring_rubric?.length ? job.scoring_rubric : [{ ...EMPTY_RUBRIC }]
  );
  const [status, setStatus] = useState<"draft" | "open">(
    job?.status === "open" ? "open" : "draft"
  );

  // AI JD drafter
  const [brief, setBrief] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState("");

  async function draftDescription() {
    if (!title || !brief) return;
    setDrafting(true);
    setDraftError("");
    try {
      const res = await fetch("/api/hire/jobs/draft-jd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, department, brief, jobId: job?.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setDescription(json.description);
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : "Draft failed");
    } finally {
      setDrafting(false);
    }
  }

  function handleListChange(
    list: string[],
    setter: (v: string[]) => void,
    idx: number,
    val: string
  ) {
    const next = [...list];
    next[idx] = val;
    setter(next);
  }

  function addListItem(list: string[], setter: (v: string[]) => void) {
    setter([...list, ""]);
  }

  function removeListItem(list: string[], setter: (v: string[]) => void, idx: number) {
    setter(list.filter((_, i) => i !== idx));
  }

  function handleRubricChange(idx: number, field: keyof RubricItem, val: string | number) {
    const next = [...rubric];
    next[idx] = { ...next[idx], [field]: val };
    setRubric(next);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const form: JobFormData = {
      title,
      department,
      location,
      description,
      must_haves: mustHaves.filter(Boolean),
      nice_to_haves: niceToHaves.filter(Boolean),
      scoring_rubric: rubric.filter((r) => r.criterion),
      status,
    };

    startTransition(async () => {
      try {
        if (job) {
          await updateJob(job.id, form);
          router.push(`/hire/jobs/${job.id}`);
        } else {
          const created = await createJob(form);
          router.push(`/hire/jobs/${created.id}`);
        }
      } catch (e) {
        console.error(e);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl">
      {/* Basic info */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-900">Basic Information</h2>

        <Field label="Job Title *">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
            placeholder="e.g. Digital Marketing Manager"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Department">
            <input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className={inputCls}
              placeholder="e.g. Marketing"
            />
          </Field>
          <Field label="Location">
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={inputCls}
              placeholder="e.g. Nairobi, Kenya"
            />
          </Field>
        </div>

        <Field label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "draft" | "open")}
            className={inputCls}
          >
            <option value="draft">Draft</option>
            <option value="open">Open</option>
          </select>
        </Field>
      </section>

      {/* Job description with AI drafter */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-900">Job Description</h2>

        <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 space-y-3">
          <p className="text-sm font-medium text-blue-800">✦ AI Draft</p>
          <p className="text-xs text-blue-600">
            Write a short brief and Claude will draft the full description for you to edit.
          </p>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. We need someone to own our social media and paid campaigns across Kenya and Ghana, with 3+ years experience..."
          />
          {draftError && <p className="text-xs text-red-600">{draftError}</p>}
          <button
            type="button"
            disabled={drafting || !title || !brief}
            onClick={draftDescription}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {drafting ? "Drafting…" : "Draft with AI"}
          </button>
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={12}
          className={`${inputCls} font-mono text-xs`}
          placeholder="Job description will appear here after AI draft, or write your own…"
        />
      </section>

      {/* Requirements */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
        <h2 className="font-semibold text-slate-900">Requirements</h2>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Must-haves</p>
          {mustHaves.map((item, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={item}
                onChange={(e) => handleListChange(mustHaves, setMustHaves, i, e.target.value)}
                className={inputCls}
                placeholder={`Must-have ${i + 1}`}
              />
              {mustHaves.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeListItem(mustHaves, setMustHaves, i)}
                  className="text-slate-400 hover:text-red-500 text-lg leading-none"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => addListItem(mustHaves, setMustHaves)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            + Add
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Nice-to-haves</p>
          {niceToHaves.map((item, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={item}
                onChange={(e) => handleListChange(niceToHaves, setNiceToHaves, i, e.target.value)}
                className={inputCls}
                placeholder={`Nice-to-have ${i + 1}`}
              />
              {niceToHaves.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeListItem(niceToHaves, setNiceToHaves, i)}
                  className="text-slate-400 hover:text-red-500 text-lg leading-none"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => addListItem(niceToHaves, setNiceToHaves)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            + Add
          </button>
        </div>
      </section>

      {/* Scoring rubric */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div>
          <h2 className="font-semibold text-slate-900">AI Screening Rubric</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Criteria used to score candidates. Weights should sum to 100.
          </p>
        </div>
        {rubric.map((item, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-start">
            <div className="col-span-4">
              <input
                value={item.criterion}
                onChange={(e) => handleRubricChange(i, "criterion", e.target.value)}
                className={inputCls}
                placeholder="Criterion"
              />
            </div>
            <div className="col-span-2">
              <input
                type="number"
                min={0}
                max={100}
                value={item.weight}
                onChange={(e) => handleRubricChange(i, "weight", Number(e.target.value))}
                className={inputCls}
                placeholder="Weight"
              />
            </div>
            <div className="col-span-5">
              <input
                value={item.description}
                onChange={(e) => handleRubricChange(i, "description", e.target.value)}
                className={inputCls}
                placeholder="What good looks like"
              />
            </div>
            <div className="col-span-1 flex justify-center pt-2">
              {rubric.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRubric(rubric.filter((_, j) => j !== i))}
                  className="text-slate-400 hover:text-red-500 text-lg leading-none"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setRubric([...rubric, { ...EMPTY_RUBRIC }])}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          + Add criterion
        </button>
      </section>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Saving…" : job ? "Save changes" : "Create job"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent";
