"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { createJob, updateJob } from "../actions";
import type { Job, JobFormData, RubricItem } from "../types";
import PageWithSidebar from "@/components/ui/PageWithSidebar";
import SidebarWidget from "@/components/ui/SidebarWidget";
import FormActions from "@/components/ui/FormActions";
import DepartmentSelect from "@/components/ui/DepartmentSelect";

interface Props {
  job?: Job;
  departments?: string[];
}

const EMPTY_RUBRIC: RubricItem = { criterion: "", weight: 20, description: "" };

const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--text-hi)] placeholder:text-[var(--text-lo)] transition-all focus:outline-none focus:border-[#f05d23] focus:ring-2 focus:ring-[#f05d23]/30";

function SectionHeader({
  icon,
  iconBg,
  iconColor,
  title,
  hint,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  hint?: string;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2.5">
        <div className={`flex h-7 w-7 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon icon={icon} className={`h-3.5 w-3.5 ${iconColor}`} />
        </div>
        <h2 className="text-md font-semibold text-[var(--text-hi)]">{title}</h2>
      </div>
      {hint && <p className="mt-1.5 text-sm text-[var(--text-lo)]">{hint}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-[var(--text-lo)]">
        {label}
      </label>
      {children}
    </div>
  );
}

function AddRowButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border)] px-3 py-2.5 text-xs font-medium text-[var(--text-lo)] transition-all hover:border-[#f05d23]/40 hover:bg-[#f05d23]/5 hover:text-[#f05d23] active:scale-[0.99]"
    >
      <Icon icon="solar:add-circle-broken" className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--text-lo)] transition-all hover:bg-red-500/10 hover:text-red-400 active:scale-90"
    >
      <Icon icon="solar:close-circle-broken" className="h-4.5 w-4.5" />
    </button>
  );
}

export function JobForm({ job, departments = [] }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
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

  const rubricTotal = rubric.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);
  const mustCount = mustHaves.filter(Boolean).length;
  const niceCount = niceToHaves.filter(Boolean).length;
  const criteriaCount = rubric.filter((r) => r.criterion).length;

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
      const saving = toast.loading(job ? "Saving changes…" : "Creating job…");
      try {
        if (job) {
          await updateJob(job.id, form);
          toast.success("Job updated", { id: saving });
          router.push(`/hire/jobs/${job.id}`);
        } else {
          const created = await createJob(form);
          toast.success("Job created", { id: saving });
          router.push(`/hire/jobs/${created.id}`);
        }
      } catch (e) {
        toast.error((e as Error).message || "Something went wrong", { id: saving });
      }
    });
  }

  const actionsProps = {
    onCancel: () => router.back(),
    onSave: () => formRef.current?.requestSubmit(),
    loading: isPending,
    saveText: job ? "Save changes" : "Create job",
    saveIcon: job ? "solar:check-circle-broken" : "solar:add-circle-broken",
  };

  const mainContent = (
    <div className="space-y-5">
      {/* ── Basic information ── */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 shadow-xl shadow-slate-200/50 hover:shadow-2xl dark:shadow-black/20 transition-shadow duration-200">
        <SectionHeader
          icon="solar:case-broken"
          iconBg="bg-[#f05d23]/15"
          iconColor="text-[#f05d23]"
          title="Basic Information"
        />

        <div className="space-y-4">
          <Field label="Job Title *">
            <div className="relative flex items-center">
              <Icon icon="solar:case-minimalistic-broken" className="pointer-events-none absolute left-3.5 h-4.5 w-4.5 text-[var(--text-lo)]" />
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`${inputCls} pl-10`}
                placeholder="e.g. Digital Marketing Manager"
              />
            </div>
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Department">
              <DepartmentSelect value={department} onChange={setDepartment} departments={departments} />
            </Field>
            <Field label="Location">
              <div className="relative flex items-center">
                <Icon icon="solar:point-on-map-broken" className="pointer-events-none absolute left-3.5 h-4.5 w-4.5 text-[var(--text-lo)]" />
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className={`${inputCls} pl-10`}
                  placeholder="e.g. Nairobi, Kenya"
                />
              </div>
            </Field>
          </div>
        </div>
      </section>

      {/* ── Job description with AI drafter ── */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 shadow-xl shadow-slate-200/50 hover:shadow-2xl dark:shadow-black/20 transition-shadow duration-200">
        <SectionHeader
          icon="solar:document-text-broken"
          iconBg="bg-violet-500/15"
          iconColor="text-violet-500"
          title="Job Description"
        />

        {/* AI brief panel */}
        <div className="mb-4 rounded-xl border border-[#f05d23]/20 bg-[#f05d23]/5 p-4">
          <div className="flex items-center gap-2">
            <Icon icon="solar:cpu-bolt-broken" className="h-4 w-4 text-[#f05d23]" />
            <p className="text-md font-semibold text-[var(--text-hi)]">AI Draft</p>
            <span className="ml-auto rounded-full bg-[#f05d23]/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#f05d23]">
              Groq
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--text-lo)]">
            Write a short brief and AI will draft the full description for you to edit.
          </p>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={3}
            className="mt-3 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--text-hi)] placeholder:text-[var(--text-lo)] transition-all focus:outline-none focus:border-[#f05d23] focus:ring-2 focus:ring-[#f05d23]/30"
            placeholder="e.g. We need someone to own our social media and paid campaigns across Kenya and Ghana, with 3+ years experience…"
          />
          {draftError && <p className="mt-2 text-xs text-red-500">{draftError}</p>}
          <button
            type="button"
            disabled={drafting || !title || !brief}
            onClick={draftDescription}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#f05d23] to-[#d94f1e] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {drafting ? (
              <>
                <Icon icon="solar:wheel-angle-broken" className="h-3.5 w-3.5 animate-spin" />
                Drafting…
              </>
            ) : (
              <>
                <Icon icon="solar:cpu-bolt-broken" className="h-3.5 w-3.5" />
                Draft with AI
              </>
            )}
          </button>
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={12}
          className={`${inputCls} font-mono text-xs leading-relaxed`}
          placeholder="Job description will appear here after AI draft, or write your own…"
        />
        <p className="mt-1.5 text-[11px] text-[var(--text-lo)]">
          {description.length.toLocaleString()} characters
        </p>
      </section>

      {/* ── Requirements ── */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 shadow-xl shadow-slate-200/50 hover:shadow-2xl dark:shadow-black/20 transition-shadow duration-200">
        <SectionHeader
          icon="solar:checklist-broken"
          iconBg="bg-green-500/15"
          iconColor="text-green-500"
          title="Requirements"
          hint="Must-haves are used to screen candidates. Nice-to-haves give AI extra context."
        />

        <div className="space-y-6">
          {/* Must-haves */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-hi)]">
              <Icon icon="solar:check-circle-broken" className="h-3.5 w-3.5 text-green-500" />
              Must-haves
            </div>
            {mustHaves.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={item}
                  onChange={(e) => handleListChange(mustHaves, setMustHaves, i, e.target.value)}
                  className={inputCls}
                  placeholder={`Requirement ${i + 1}`}
                />
                {mustHaves.length > 1 && (
                  <RemoveButton
                    label="Remove requirement"
                    onClick={() => removeListItem(mustHaves, setMustHaves, i)}
                  />
                )}
              </div>
            ))}
            <AddRowButton
              label="Add requirement"
              onClick={() => addListItem(mustHaves, setMustHaves)}
            />
          </div>

          {/* Nice-to-haves */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-hi)]">
              <Icon icon="solar:star-broken" className="h-3.5 w-3.5 text-blue-400" />
              Nice-to-haves
            </div>
            {niceToHaves.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={item}
                  onChange={(e) => handleListChange(niceToHaves, setNiceToHaves, i, e.target.value)}
                  className={inputCls}
                  placeholder={`Bonus point ${i + 1}`}
                />
                {niceToHaves.length > 1 && (
                  <RemoveButton
                    label="Remove nice-to-have"
                    onClick={() => removeListItem(niceToHaves, setNiceToHaves, i)}
                  />
                )}
              </div>
            ))}
            <AddRowButton
              label="Add nice-to-have"
              onClick={() => addListItem(niceToHaves, setNiceToHaves)}
            />
          </div>
        </div>
      </section>

      {/* ── Scoring rubric ── */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 shadow-xl shadow-slate-200/50 hover:shadow-2xl dark:shadow-black/20 transition-shadow duration-200">
        <div className="mb-5 flex items-start justify-between gap-3">
          <SectionHeader
            icon="solar:chart-square-broken"
            iconBg="bg-blue-500/15"
            iconColor="text-blue-500"
            title="AI Screening Rubric"
            hint="Criteria used to score candidates. Weights should sum to 100."
          />
          <span
            className={`mt-0.5 shrink-0 rounded-full px-2.5 py-1 font-mono text-[11px] font-bold ${
              rubricTotal === 100
                ? "bg-green-500/10 text-green-500"
                : "bg-amber-500/10 text-amber-500"
            }`}
            title="Total weight of all criteria"
          >
            {rubricTotal}/100
          </span>
        </div>

        <div className="space-y-2">
          {rubric.map((item, i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-2">
              <div className="col-span-12 sm:col-span-4">
                <input
                  value={item.criterion}
                  onChange={(e) => handleRubricChange(i, "criterion", e.target.value)}
                  className={inputCls}
                  placeholder="Criterion"
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <div className="relative flex items-center">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={item.weight}
                    onChange={(e) => handleRubricChange(i, "weight", Number(e.target.value))}
                    className={`${inputCls} pr-6 font-mono`}
                    placeholder="Weight"
                  />
                  <span className="pointer-events-none absolute right-3 text-[10px] text-[var(--text-lo)]">%</span>
                </div>
              </div>
              <div className="col-span-7 sm:col-span-5">
                <input
                  value={item.description}
                  onChange={(e) => handleRubricChange(i, "description", e.target.value)}
                  className={inputCls}
                  placeholder="What good looks like"
                />
              </div>
              <div className="col-span-1 flex justify-end sm:justify-center">
                {rubric.length > 1 && (
                  <RemoveButton
                    label="Remove criterion"
                    onClick={() => setRubric(rubric.filter((_, j) => j !== i))}
                  />
                )}
              </div>
            </div>
          ))}
          <AddRowButton
            label="Add criterion"
            onClick={() => setRubric([...rubric, { ...EMPTY_RUBRIC }])}
          />
        </div>
      </section>
    </div>
  );

  const sidebar = (
    <>
      {/* ── Status ── */}
      <SidebarWidget title="Status" icon="solar:eye-broken" iconClass="bg-[#f05d23]/15 text-[#f05d23]">
        <div className="flex rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-1">
          {(["draft", "open"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
                status === s
                  ? "bg-[#f05d23] text-white shadow-sm"
                  : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
              }`}
            >
              <Icon
                icon={s === "open" ? "solar:eye-broken" : "solar:eye-closed-broken"}
                className="h-3.5 w-3.5"
              />
              {s}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-[var(--text-lo)]">
          {status === "open"
            ? "Visible on your public careers page and accepting applications."
            : "Only visible to your team — nobody can apply yet."}
        </p>
      </SidebarWidget>

      {/* ── Live summary ── */}
      <SidebarWidget title="Summary" icon="solar:chart-square-broken" iconClass="bg-blue-500/15 text-blue-500">
        <dl className="space-y-2.5">
          <div className="flex items-center justify-between">
            <dt className="text-sm text-[var(--text-lo)]">Must-haves</dt>
            <dd className="font-mono text-sm font-semibold text-[var(--text-hi)]">{mustCount}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-sm text-[var(--text-lo)]">Nice-to-haves</dt>
            <dd className="font-mono text-sm font-semibold text-[var(--text-hi)]">{niceCount}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-sm   text-[var(--text-lo)]">Rubric criteria</dt>
            <dd className="font-mono text-sm font-semibold text-[var(--text-hi)]">{criteriaCount}</dd>
          </div>
          <div className="flex items-center justify-between border-t border-[var(--border)] pt-2.5">
            <dt className="text-sm text-[var(--text-lo)]">Rubric weight</dt>
            <dd
              className={`font-mono text-sm font-bold ${
                rubricTotal === 100 ? "text-green-500" : "text-amber-500"
              }`}
            >
              {rubricTotal}/100
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-sm text-[var(--text-lo)]">Description</dt>
            <dd className="font-mono text-sm font-semibold text-[var(--text-hi)]">
              {description.length.toLocaleString()} chars
            </dd>
          </div>
        </dl>
      </SidebarWidget>

      {/* ── Meta (edit mode) ── */}
      {job && (
        <SidebarWidget title="Meta" icon="solar:calendar-broken">
          <dl className="space-y-2.5">
            <div className="flex items-center justify-between">
              <dt className="text-sm text-[var(--text-lo)]">Created</dt>
              <dd className="text-sm font-medium text-[var(--text-hi)]">
                {new Date(job.created_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-xs text-[var(--text-lo)]">Updated</dt>
              <dd className="text-xs font-medium text-[var(--text-hi)]">
                {new Date(job.updated_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </dd>
            </div>
          </dl>
        </SidebarWidget>
      )}

      {/* ── Actions ── */}
      <SidebarWidget title="Actions" icon="solar:settings-broken">
        <FormActions layout="vertical" {...actionsProps} />
      </SidebarWidget>
    </>
  );

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="pb-28 lg:pb-0">
      <PageWithSidebar main={mainContent} sidebar={sidebar} />

      {/* Mobile-only fixed bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--surface)] p-3 shadow-lg lg:hidden">
        <FormActions layout="page-footer" {...actionsProps} />
      </div>
    </form>
  );
}
