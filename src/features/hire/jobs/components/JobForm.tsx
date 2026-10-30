"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { createJob, updateJob } from "../actions";
import type { Job, JobFormData, RubricItem } from "../types";
import PageWithSidebar from "@/components/ui/PageWithSidebar";
import SidebarWidget from "@/components/ui/SidebarWidget";
import FormActions from "@/components/ui/FormActions";
import DepartmentSelect from "@/components/ui/DepartmentSelect";
import DateRangePicker, {
  type DateRangeValue,
} from "@/components/ui/DateRangePicker";
import { Button } from "@/components/ui/Button";
import { usePageHeader } from "@/shared/contexts/PageHeaderContext";
import { publicJobUrl } from "@/lib/careers-url";
import { useUnsavedChanges } from "@/shared/contexts/UnsavedChangesContext";

interface Props {
  job?: Job;
  departments?: string[];
}

const EMPTY_RUBRIC: RubricItem = { criterion: "", weight: 20, description: "" };

const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--text-hi)] placeholder:text-[var(--text-lo)] transition-all focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";

function toScheduleRange(job?: Job): DateRangeValue | undefined {
  if (!job?.published_at || !job.closes_at) return undefined;
  return {
    startDate: new Date(job.published_at),
    endDate: new Date(job.closes_at),
    label: "Custom Range",
  };
}

function matchExistingDepartment(value: string, departments: string[]) {
  const clean = (name: string) =>
    name
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const source = clean(value);
  const exact = departments.find((department) => clean(department) === source);
  if (exact) return exact;

  const sourceTokens = new Set(
    source.split(" ").filter((token) => token && token !== "and"),
  );
  let best: { department: string; score: number; matches: number } | null =
    null;
  for (const department of departments) {
    const targetTokens = new Set(
      clean(department)
        .split(" ")
        .filter((token) => token && token !== "and"),
    );
    const matches = [...sourceTokens].filter((token) =>
      targetTokens.has(token),
    ).length;
    const score = matches / Math.max(sourceTokens.size, targetTokens.size, 1);
    if (!best || score > best.score) best = { department, score, matches };
  }
  return best && best.matches >= 2 && best.score >= 0.5
    ? best.department
    : null;
}

function scheduleSnapshot(value: DateRangeValue | undefined) {
  return {
    start: value?.startDate?.toISOString() ?? null,
    end: value?.endDate?.toISOString() ?? null,
  };
}

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
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-xl ${iconBg}`}
        >
          <Icon icon={icon} className={`h-3.5 w-3.5 ${iconColor}`} />
        </div>
        <h2 className="text-md font-semibold text-[var(--text-hi)]">{title}</h2>
      </div>
      {hint && <p className="mt-1.5 text-sm text-[var(--text-lo)]">{hint}</p>}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-[var(--text-lo)]">
        {label}
      </label>
      {children}
    </div>
  );
}

function AddRowButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border)] px-3 py-2.5 text-xs font-medium text-[var(--text-lo)] transition-all hover:border-brand-500/40 hover:bg-brand-500/5 hover:text-brand-500 active:scale-[0.99]"
    >
      <Icon icon="solar:add-circle-broken" className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function RemoveButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
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
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(job?.title ?? "");
  const [department, setDepartment] = useState(job?.department ?? "");
  const [location, setLocation] = useState(job?.location ?? "");
  const [description, setDescription] = useState(job?.description ?? "");
  const [mustHaves, setMustHaves] = useState<string[]>(
    job?.requirements?.must_haves ?? [""],
  );
  const [niceToHaves, setNiceToHaves] = useState<string[]>(
    job?.requirements?.nice_to_haves ?? [""],
  );
  const [rubric, setRubric] = useState<RubricItem[]>(
    job?.scoring_rubric?.length ? job.scoring_rubric : [{ ...EMPTY_RUBRIC }],
  );
  const [status, setStatus] = useState<"draft" | "open">(
    job?.status === "open" ? "open" : "draft",
  );
  const [schedule, setSchedule] = useState<DateRangeValue | undefined>(() =>
    toScheduleRange(job),
  );
  const [employmentType, setEmploymentType] = useState(
    job?.employment_type ?? "",
  );
  const [workMode, setWorkMode] = useState(job?.work_mode ?? "");
  const [contractDuration, setContractDuration] = useState(
    job?.contract_duration ?? "",
  );
  const [compensation, setCompensation] = useState(job?.compensation ?? "");
  const [reportsTo, setReportsTo] = useState(job?.reports_to ?? "");
  const [benefits, setBenefits] = useState(job?.benefits ?? "");
  const [applicationInstructions, setApplicationInstructions] = useState(
    job?.application_instructions ?? "",
  );
  const [selectionProcess, setSelectionProcess] = useState(
    job?.selection_process ?? "",
  );
  const [sourceDocumentUrl, setSourceDocumentUrl] = useState(
    job?.source_document_url ?? "",
  );
  const [googleDocUrl, setGoogleDocUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const { setUnsaved, setCallbacks, confirmNavigation } = useUnsavedChanges();

  // AI JD drafter
  const [brief, setBrief] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState("");

  const rubricTotal = rubric.reduce(
    (sum, r) => sum + (Number(r.weight) || 0),
    0,
  );
  const mustCount = mustHaves.filter(Boolean).length;
  const niceCount = niceToHaves.filter(Boolean).length;
  const criteriaCount = rubric.filter((r) => r.criterion).length;
  const isScheduledForLater =
    status === "open" &&
    !!schedule?.startDate &&
    schedule.startDate > new Date();

  const initialForm = useMemo(
    () =>
      JSON.stringify({
        title: job?.title ?? "",
        department: job?.department ?? "",
        location: job?.location ?? "",
        description: job?.description ?? "",
        mustHaves: job?.requirements?.must_haves ?? [""],
        niceToHaves: job?.requirements?.nice_to_haves ?? [""],
        rubric: job?.scoring_rubric?.length
          ? job.scoring_rubric
          : [{ ...EMPTY_RUBRIC }],
        status: job?.status === "open" ? "open" : "draft",
        schedule: scheduleSnapshot(toScheduleRange(job)),
        employmentType: job?.employment_type ?? "",
        workMode: job?.work_mode ?? "",
        contractDuration: job?.contract_duration ?? "",
        compensation: job?.compensation ?? "",
        reportsTo: job?.reports_to ?? "",
        benefits: job?.benefits ?? "",
        applicationInstructions: job?.application_instructions ?? "",
        selectionProcess: job?.selection_process ?? "",
        sourceDocumentUrl: job?.source_document_url ?? "",
      }),
    [job],
  );
  const isDirty =
    initialForm !==
    JSON.stringify({
      title,
      department,
      location,
      description,
      mustHaves,
      niceToHaves,
      rubric,
      status,
      schedule: scheduleSnapshot(schedule),
      employmentType,
      workMode,
      contractDuration,
      compensation,
      reportsTo,
      benefits,
      applicationInstructions,
      selectionProcess,
      sourceDocumentUrl,
    });

  useEffect(() => {
    setUnsaved(isDirty, job ? "Unsaved job changes" : "New job changes");
  }, [isDirty, job, setUnsaved]);

  useEffect(() => {
    setCallbacks({
      onSave: () => formRef.current?.requestSubmit(),
      onDiscard: () => window.location.reload(),
    });
    return () => setCallbacks({});
  }, [setCallbacks]);

  const headerActions = [
    {
      label: "Back to Jobs",
      icon: "solar:arrow-left-broken",
      variant: "secondary" as const,
      onClick: () => {
        if (confirmNavigation()) router.push("/hire/jobs");
      },
    },
    ...(job
      ? [
          {
            label: "View Job",
            icon: "solar:eye-broken",
            variant: "secondary" as const,
            onClick: () => {
              if (confirmNavigation()) router.push(`/hire/jobs/${job.id}`);
            },
          },
          ...(job.status === "open" &&
          (!job.published_at || new Date(job.published_at) <= new Date()) &&
          (!job.closes_at || new Date(job.closes_at) > new Date())
            ? [
                {
                  label: "Careers page",
                  icon: "solar:global-broken",
                  variant: "secondary" as const,
                  onClick: () =>
                    window.open(
                      publicJobUrl(job.slug),
                      "_blank",
                      "noopener,noreferrer",
                    ),
                },
              ]
            : []),
        ]
      : []),
  ];

  usePageHeader({
    title: job ? "Edit Job" : "New Job",
    description: job?.title ?? "Create a role and set up AI screening",
    icon: "solar:case-minimalistic-broken",
    actions: headerActions,
  });

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

  async function importJobDescription() {
    const document = documentInputRef.current?.files?.[0];
    if (!document && !googleDocUrl.trim()) {
      setImportError("Choose a PDF/DOCX file or paste a Google Docs link.");
      return;
    }
    if (document && googleDocUrl.trim()) {
      setImportError("Choose either a document or a Google Docs link.");
      return;
    }

    setImporting(true);
    setImportError("");
    try {
      const payload = new FormData();
      if (document) payload.append("document", document);
      if (googleDocUrl.trim())
        payload.append("googleDocUrl", googleDocUrl.trim());
      const response = await fetch("/api/hire/jobs/import-description", {
        method: "POST",
        body: payload,
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        job?: Partial<JobFormData>;
      } | null;
      if (!response.ok || !data?.job)
        throw new Error(
          data?.error ?? "We could not import that job description.",
        );

      const imported = data.job;
      if (imported.title) setTitle(imported.title);
      if (imported.department) {
        const matchedDepartment = matchExistingDepartment(
          imported.department,
          departments,
        );
        setDepartment(matchedDepartment ?? "");
        if (matchedDepartment && matchedDepartment !== imported.department) {
          toast(`Mapped department to “${matchedDepartment}”.`);
        } else if (!matchedDepartment) {
          toast("Choose or add a department before saving.");
        }
      }
      if (imported.location) setLocation(imported.location);
      if (imported.description) setDescription(imported.description);
      if (imported.must_haves?.length) setMustHaves(imported.must_haves);
      if (imported.nice_to_haves?.length)
        setNiceToHaves(imported.nice_to_haves);
      if (imported.scoring_rubric?.length) setRubric(imported.scoring_rubric);
      if (imported.employment_type) setEmploymentType(imported.employment_type);
      if (imported.work_mode) setWorkMode(imported.work_mode);
      if (imported.contract_duration)
        setContractDuration(imported.contract_duration);
      if (imported.compensation) setCompensation(imported.compensation);
      if (imported.reports_to) setReportsTo(imported.reports_to);
      if (imported.benefits) setBenefits(imported.benefits);
      if (imported.application_instructions)
        setApplicationInstructions(imported.application_instructions);
      if (imported.selection_process)
        setSelectionProcess(imported.selection_process);
      if (googleDocUrl.trim()) setSourceDocumentUrl(googleDocUrl.trim());
      toast.success("Job details imported. Review them before saving.");
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : "We could not import that job description.",
      );
    } finally {
      setImporting(false);
    }
  }

  function handleListChange(
    list: string[],
    setter: (v: string[]) => void,
    idx: number,
    val: string,
  ) {
    const next = [...list];
    next[idx] = val;
    setter(next);
  }

  function addListItem(list: string[], setter: (v: string[]) => void) {
    setter([...list, ""]);
  }

  function removeListItem(
    list: string[],
    setter: (v: string[]) => void,
    idx: number,
  ) {
    setter(list.filter((_, i) => i !== idx));
  }

  function handleRubricChange(
    idx: number,
    field: keyof RubricItem,
    val: string | number,
  ) {
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
      employment_type: employmentType,
      work_mode: workMode,
      contract_duration: contractDuration,
      compensation,
      reports_to: reportsTo,
      benefits,
      application_instructions: applicationInstructions,
      selection_process: selectionProcess,
      source_document_url: sourceDocumentUrl,
      published_at: schedule?.startDate?.toISOString() ?? null,
      // A date range represents inclusive calendar dates, so a job remains
      // live through the end of its selected closing date.
      closes_at: schedule?.endDate
        ? new Date(
            schedule.endDate.getFullYear(),
            schedule.endDate.getMonth(),
            schedule.endDate.getDate(),
            23,
            59,
            59,
            999,
          ).toISOString()
        : null,
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
        toast.error((e as Error).message || "Something went wrong", {
          id: saving,
        });
      }
    });
  }

  const actionsProps = {
    onCancel: () => {
      if (confirmNavigation()) router.back();
    },
    onSave: () => formRef.current?.requestSubmit(),
    loading: isPending,
    disabled: !isDirty,
    saveText: job ? "Save changes" : "Create job",
    saveIcon: job ? "solar:check-circle-broken" : "solar:add-circle-broken",
  };

  const mainContent = (
    <div className="space-y-5">
      <section className="rounded-2xl border border-brand-500/20 bg-brand-500/[0.04] p-5 shadow-xl shadow-slate-200/30 dark:shadow-black/10 sm:p-6">
        <SectionHeader
          icon="solar:import-broken"
          iconBg="bg-brand-500/15"
          iconColor="text-brand-500"
          title="Import job description"
          hint="Upload a PDF or DOCX, or use a Google Doc. Public links work immediately; internal Growthpad Docs use your connected Google account."
        />
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end">
          <Field label="Job description file">
            <input
              ref={documentInputRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className={`${inputCls} file:mr-3 file:rounded-lg file:border-0 file:bg-brand-500/10 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-brand-500`}
            />
          </Field>
          <p className="pb-2 text-center text-xs font-medium text-[var(--text-lo)]">
            or
          </p>
          <Field label="Google Docs link">
            <input
              value={googleDocUrl}
              onChange={(event) => setGoogleDocUrl(event.target.value)}
              className={inputCls}
              placeholder="https://docs.google.com/document/d/..."
            />
          </Field>
        </div>
        {importError && (
          <p className="mt-3 text-xs font-medium text-red-500">{importError}</p>
        )}
        <Button
          type="button"
          size="sm"
          className="mt-4"
          icon={
            importing
              ? "solar:wheel-angle-broken"
              : "solar:magic-stick-3-broken"
          }
          loading={importing}
          disabled={importing}
          onClick={importJobDescription}
        >
          {importing ? "Reading job description" : "Import and fill form"}
        </Button>
      </section>

      {/* ── Basic information ── */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 shadow-xl shadow-slate-200/50 hover:shadow-2xl dark:shadow-black/20 transition-shadow duration-200">
        <SectionHeader
          icon="solar:case-broken"
          iconBg="bg-brand-500/15"
          iconColor="text-brand-500"
          title="Basic Information"
        />

        <div className="space-y-4">
          <Field label="Job Title *">
            <div className="relative flex items-center">
              <Icon
                icon="solar:case-minimalistic-broken"
                className="pointer-events-none absolute left-3.5 h-4.5 w-4.5 text-[var(--text-lo)]"
              />
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
              <DepartmentSelect
                value={department}
                onChange={setDepartment}
                departments={departments}
              />
            </Field>
            <Field label="Location">
              <div className="relative flex items-center">
                <Icon
                  icon="solar:point-on-map-broken"
                  className="pointer-events-none absolute left-3.5 h-4.5 w-4.5 text-[var(--text-lo)]"
                />
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

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 transition-shadow duration-200 hover:shadow-2xl dark:shadow-black/20 sm:p-6">
        <SectionHeader
          icon="solar:case-round-broken"
          iconBg="bg-brand-500/15"
          iconColor="text-brand-500"
          title="Employment details"
          hint="Set the practical terms candidates need before they apply."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Employment type">
            <input
              value={employmentType}
              onChange={(event) => setEmploymentType(event.target.value)}
              className={inputCls}
              placeholder="e.g. Full-time internship"
            />
          </Field>
          <Field label="Work mode">
            <input
              value={workMode}
              onChange={(event) => setWorkMode(event.target.value)}
              className={inputCls}
              placeholder="e.g. Hybrid"
            />
          </Field>
          <Field label="Duration">
            <input
              value={contractDuration}
              onChange={(event) => setContractDuration(event.target.value)}
              className={inputCls}
              placeholder="e.g. 6 months"
            />
          </Field>
          <Field label="Compensation">
            <input
              value={compensation}
              onChange={(event) => setCompensation(event.target.value)}
              className={inputCls}
              placeholder="e.g. Monthly stipend plus commission"
            />
          </Field>
          <Field label="Reports to">
            <input
              value={reportsTo}
              onChange={(event) => setReportsTo(event.target.value)}
              className={inputCls}
              placeholder="e.g. Business Development Lead"
            />
          </Field>
        </div>
      </section>

      {/* ── Job description with AI drafter ── */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 shadow-xl shadow-slate-200/50 hover:shadow-2xl dark:shadow-black/20 transition-shadow duration-200">
        <SectionHeader
          icon="solar:document-text-broken"
          iconBg="bg-brand-500/15"
          iconColor="text-brand-500"
          title="Job Description"
        />

        {/* AI brief panel */}
        <div className="mb-4 rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
          <div className="flex items-center gap-2">
            <Icon
              icon="solar:cpu-bolt-broken"
              className="h-4 w-4 text-brand-500"
            />
            <p className="text-md font-semibold text-[var(--text-hi)]">
              AI Draft
            </p>
            <span className="ml-auto rounded-full bg-brand-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-brand-500">
              Groq
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--text-lo)]">
            Write a short brief and AI will draft the full description for you
            to edit.
          </p>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={3}
            className="mt-3 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--text-hi)] placeholder:text-[var(--text-lo)] transition-all focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
            placeholder="e.g. We need someone to own our social media and paid campaigns across Kenya and Ghana, with 3+ years experience…"
          />
          {draftError && (
            <p className="mt-2 text-xs text-red-500">{draftError}</p>
          )}
          <button
            type="button"
            disabled={drafting || !title || !brief}
            onClick={draftDescription}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {drafting ? (
              <>
                <Icon
                  icon="solar:wheel-angle-broken"
                  className="h-3.5 w-3.5 animate-spin"
                />
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
          iconBg="bg-brand-500/15"
          iconColor="text-brand-500"
          title="Requirements"
          hint="Must-haves are used to screen candidates. Nice-to-haves give AI extra context."
        />

        <div className="space-y-6">
          {/* Must-haves */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-hi)]">
              <Icon
                icon="solar:check-circle-broken"
                className="h-3.5 w-3.5 text-green-500"
              />
              Must-haves
            </div>
            {mustHaves.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={item}
                  onChange={(e) =>
                    handleListChange(mustHaves, setMustHaves, i, e.target.value)
                  }
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
              <Icon
                icon="solar:star-broken"
                className="h-3.5 w-3.5 text-blue-400"
              />
              Nice-to-haves
            </div>
            {niceToHaves.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={item}
                  onChange={(e) =>
                    handleListChange(
                      niceToHaves,
                      setNiceToHaves,
                      i,
                      e.target.value,
                    )
                  }
                  className={inputCls}
                  placeholder={`Bonus point ${i + 1}`}
                />
                {niceToHaves.length > 1 && (
                  <RemoveButton
                    label="Remove nice-to-have"
                    onClick={() =>
                      removeListItem(niceToHaves, setNiceToHaves, i)
                    }
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

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 transition-shadow duration-200 hover:shadow-2xl dark:shadow-black/20 sm:p-6">
        <SectionHeader
          icon="solar:letter-broken"
          iconBg="bg-brand-500/15"
          iconColor="text-brand-500"
          title="Candidate experience"
          hint="Make the application expectations and hiring process clear before publishing."
        />
        <div className="space-y-4">
          <Field label="What we offer">
            <textarea
              value={benefits}
              onChange={(event) => setBenefits(event.target.value)}
              rows={4}
              className={inputCls}
              placeholder="Benefits, learning support, leave, or other reasons to join."
            />
          </Field>
          <Field label="How to apply">
            <textarea
              value={applicationInstructions}
              onChange={(event) =>
                setApplicationInstructions(event.target.value)
              }
              rows={3}
              className={inputCls}
              placeholder="Documents to include, cover-note prompt, and any application requirements."
            />
          </Field>
          <Field label="Selection process">
            <textarea
              value={selectionProcess}
              onChange={(event) => setSelectionProcess(event.target.value)}
              rows={3}
              className={inputCls}
              placeholder="e.g. Screening call, practical task, interview, and reference checks."
            />
          </Field>
        </div>
      </section>

      {/* ── Scoring rubric ── */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 shadow-xl shadow-slate-200/50 hover:shadow-2xl dark:shadow-black/20 transition-shadow duration-200">
        <div className="mb-5 flex items-start justify-between gap-3">
          <SectionHeader
            icon="solar:chart-square-broken"
            iconBg="bg-brand-500/15"
            iconColor="text-brand-500"
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
                  onChange={(e) =>
                    handleRubricChange(i, "criterion", e.target.value)
                  }
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
                    onChange={(e) =>
                      handleRubricChange(i, "weight", Number(e.target.value))
                    }
                    className={`${inputCls} pr-6 font-mono`}
                    placeholder="Weight"
                  />
                  <span className="pointer-events-none absolute right-3 text-[10px] text-[var(--text-lo)]">
                    %
                  </span>
                </div>
              </div>
              <div className="col-span-7 sm:col-span-5">
                <input
                  value={item.description}
                  onChange={(e) =>
                    handleRubricChange(i, "description", e.target.value)
                  }
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
      <SidebarWidget
        title="Status"
        icon="solar:eye-broken"
        iconClass="bg-brand-500/15 text-brand-500"
      >
        <div className="flex rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-1">
          {(["draft", "open"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
                status === s
                  ? "bg-brand-500 text-white shadow-sm"
                  : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
              }`}
            >
              <Icon
                icon={
                  s === "open" ? "solar:eye-broken" : "solar:eye-closed-broken"
                }
                className="h-3.5 w-3.5"
              />
              {s}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-[var(--text-lo)]">
          {status === "open"
            ? isScheduledForLater
              ? "Scheduled for your public careers page at the chosen publish time."
              : "Visible on your public careers page and accepting applications."
            : "Only visible to your team — nobody can apply yet."}
        </p>
      </SidebarWidget>

      <SidebarWidget
        title="Publishing schedule"
        icon="solar:calendar-broken"
        iconClass="bg-brand-500/15 text-brand-500"
      >
        <div className="space-y-3">
          <Field label="Live dates">
            <DateRangePicker
              value={schedule}
              onChange={(value) => {
                setSchedule(value);
                setStatus("open");
              }}
              allowedRanges={["Custom Range"]}
              minDate={new Date()}
              maxDate={null}
              fullWidth
            />
          </Field>
          {schedule && (
            <button
              type="button"
              onClick={() => setSchedule(undefined)}
              className="text-xs font-semibold text-brand-500 hover:underline"
            >
              Clear schedule
            </button>
          )}
          <p className="text-xs leading-relaxed text-[var(--text-lo)]">
            Select the first and last dates the role should accept applications.
            Leave this blank to publish immediately when set to Open and keep it
            live until you close it.
          </p>
        </div>
      </SidebarWidget>

      {/* ── Live summary ── */}
      <SidebarWidget
        title="Summary"
        icon="solar:chart-square-broken"
        iconClass="bg-brand-500/15 text-brand-500"
      >
        <dl className="space-y-2.5">
          <div className="flex items-center justify-between">
            <dt className="text-sm text-[var(--text-lo)]">Must-haves</dt>
            <dd className="font-mono text-sm font-semibold text-[var(--text-hi)]">
              {mustCount}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-sm text-[var(--text-lo)]">Nice-to-haves</dt>
            <dd className="font-mono text-sm font-semibold text-[var(--text-hi)]">
              {niceCount}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-sm   text-[var(--text-lo)]">Rubric criteria</dt>
            <dd className="font-mono text-sm font-semibold text-[var(--text-hi)]">
              {criteriaCount}
            </dd>
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
        <SidebarWidget
          title="Meta"
          icon="solar:calendar-broken"
          iconClass="bg-brand-500/15 text-brand-500"
        >
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
              <dt className="text-xs text-[var(--text-lo)]">Publishes</dt>
              <dd className="text-xs font-medium text-[var(--text-hi)]">
                {job.published_at
                  ? new Date(job.published_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "Not scheduled"}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-xs text-[var(--text-lo)]">Closes</dt>
              <dd className="text-xs font-medium text-[var(--text-hi)]">
                {job.closes_at
                  ? new Date(job.closes_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "No end date"}
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
      <SidebarWidget
        title="Actions"
        icon="solar:settings-broken"
        iconClass="bg-brand-500/15 text-brand-500"
      >
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
