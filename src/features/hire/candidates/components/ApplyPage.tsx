"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import Image from "next/image";

type PublicJob = {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  description: string | null;
  requirements: { must_haves?: string[]; nice_to_haves?: string[] } | null;
  employmentType: string | null;
  workMode: string | null;
  contractDuration: string | null;
  compensation: string | null;
  reportsTo: string | null;
  benefits: string | null;
  applicationInstructions: string | null;
  selectionProcess: string | null;
  closesAt: string | null;
};

interface Props {
  job: PublicJob;
  company?: string;
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10";

export function ApplyPage({
  job,
  company = "Growthpad Consulting Group",
}: Props) {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    location: "",
    source: "direct",
    consented: false,
  });
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [step, setStep] = useState<"form" | "uploading" | "done" | "error">(
    "form",
  );
  const [errorMsg, setErrorMsg] = useState("");

  const mustHaves = job.requirements?.must_haves?.filter(Boolean) ?? [];
  const niceToHaves = job.requirements?.nice_to_haves?.filter(Boolean) ?? [];
  const closeDate = job.closesAt ? new Date(job.closesAt) : null;
  const closingLabel = closeDate
    ? `Applications close ${closeDate.toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}`
    : "Applications are reviewed as they arrive";

  function update(key: keyof typeof form, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.consented) return;
    setStep("uploading");
    setErrorMsg("");

    try {
      if (cvFile) {
        // The CV is read before the application is saved, so an unreadable file never leaves a half-finished application.
        const payload = new FormData();
        for (const [key, value] of Object.entries(form))
          payload.append(
            key,
            typeof value === "boolean" ? String(value) : value,
          );
        payload.append("job_id", job.id);
        payload.append("consented", String(form.consented));
        payload.append("cv", cvFile);
        const response = await fetch("/api/hire/candidates/apply-with-cv", {
          method: "POST",
          body: payload,
        });
        const application = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(
            application.error ??
              "We could not submit your application. Please try again.",
          );
      } else {
        const response = await fetch("/api/hire/candidates/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ job_id: job.id, ...form }),
        });
        const application = await response.json();
        if (!response.ok) throw new Error(application.error);
      }

      setStep("done");
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : "We could not submit your application. Please try again.",
      );
      setStep("error");
    }
  }

  if (step === "done") {
    return (
      <main className="flex min-h-screen items-center justify-center overflow-hidden bg-[#fffaf7] px-5 py-12">
        <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-orange-100 bg-white p-8 text-center shadow-2xl shadow-orange-950/10 sm:p-12">
          <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-brand-500/15 blur-3xl" />
          <div className="relative">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
              <Icon icon="solar:check-circle-broken" className="h-8 w-8" />
            </span>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-brand-500">
              Kazi Hire
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Application received
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-600">
              Thank you for applying for{" "}
              <span className="font-semibold text-slate-900">{job.title}</span>{" "}
              at {company}. If your experience is a fit, the team will be in
              touch.
            </p>
            <div className="mt-7 rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
              Kazi supports the hiring process, but every decision is made by
              people.
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fffaf7] text-slate-900">
      <header className="border-b border-orange-100/80 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.svg"
              alt="Growthpad"
              width={94}
              height={36}
              priority
              className="h-14 w-auto"
            />
            <span className="h-6 w-px bg-orange-100" />
            <div>
              <p className="text-sm font-semibold tracking-tight text-slate-950">
                Kazi Hire
              </p>
              <p className="text-[11px] text-slate-500">Careers</p>
            </div>
          </div>
          <span className="hidden rounded-full bg-orange-50 px-3 py-1.5 text-xs font-medium text-brand-600 sm:inline-flex">
            A better way to apply
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="mb-7 rounded-3xl bg-gradient-to-br from-[#28150d] via-[#592511] to-brand-500 px-6 py-7 text-white shadow-xl shadow-orange-950/15 sm:px-9 sm:py-9">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-200">
            Open opportunity
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
            {job.title}
          </h1>
          <div className="mt-5 flex flex-wrap gap-2 text-sm text-orange-50">
            <Meta
              icon="solar:buildings-broken"
              value={job.department ?? "Growthpad"}
            />
            <Meta
              icon="solar:map-point-broken"
              value={job.location ?? "Location flexible"}
            />
            {job.workMode && (
              <Meta icon="solar:home-2-broken" value={job.workMode} />
            )}
            <Meta icon="solar:calendar-broken" value={closingLabel} />
          </div>
        </div>

        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,0.92fr)_minmax(430px,1.08fr)]">
          <aside className="space-y-5 lg:sticky lg:top-7">
            <section className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm sm:p-6">
              <SectionHeading
                icon="solar:document-text-broken"
                title="About this role"
              />
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">
                {job.description?.trim() ||
                  "Join our team and help us deliver meaningful work for the organisations we serve."}
              </p>
            </section>
            {(job.employmentType ||
              job.contractDuration ||
              job.compensation ||
              job.reportsTo) && (
              <section className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm sm:p-6">
                <SectionHeading icon="solar:case-broken" title="Role details" />
                <dl className="space-y-3 text-sm">
                  {job.employmentType && (
                    <RoleDetail label="Employment" value={job.employmentType} />
                  )}
                  {job.contractDuration && (
                    <RoleDetail label="Duration" value={job.contractDuration} />
                  )}
                  {job.compensation && (
                    <RoleDetail label="Compensation" value={job.compensation} />
                  )}
                  {job.reportsTo && (
                    <RoleDetail label="Reports to" value={job.reportsTo} />
                  )}
                </dl>
              </section>
            )}
            {(mustHaves.length > 0 || niceToHaves.length > 0) && (
              <section className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm sm:p-6">
                <SectionHeading
                  icon="solar:medal-ribbon-star-broken"
                  title="What to bring"
                />
                <div className="space-y-5">
                  {mustHaves.length > 0 && (
                    <RequirementList
                      title="Core requirements"
                      items={mustHaves}
                      tone="emerald"
                    />
                  )}
                  {niceToHaves.length > 0 && (
                    <RequirementList
                      title="Nice to have"
                      items={niceToHaves}
                      tone="orange"
                    />
                  )}
                </div>
              </section>
            )}
            {job.benefits && (
              <section className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm sm:p-6">
                <SectionHeading
                  icon="solar:heart-broken"
                  title="What we offer"
                />
                <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">
                  {job.benefits}
                </p>
              </section>
            )}
            {(job.applicationInstructions || job.selectionProcess) && (
              <section className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm sm:p-6">
                <SectionHeading
                  icon="solar:clipboard-check-broken"
                  title="Before you apply"
                />
                {job.applicationInstructions && (
                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">
                    {job.applicationInstructions}
                  </p>
                )}
                {job.selectionProcess && (
                  <p className="mt-4 border-t border-orange-100 pt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                    <span className="font-semibold text-slate-800">
                      Selection process
                    </span>
                    <br />
                    {job.selectionProcess}
                  </p>
                )}
              </section>
            )}
            <p className="px-2 text-xs leading-5 text-slate-500">
              We welcome applications from qualified candidates of all
              backgrounds. Need an accommodation during the process? Let us know
              in your application.
            </p>
          </aside>

          <section className="rounded-3xl border border-orange-100 bg-white p-5 shadow-xl shadow-orange-950/5 sm:p-7">
            <div className="flex items-start gap-3 border-b border-slate-100 pb-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                <Icon icon="solar:pen-new-square-broken" className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Start your application
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Share a few details. This takes about three minutes.
                </p>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name *">
                  <input
                    autoFocus
                    required
                    value={form.full_name}
                    onChange={(event) =>
                      update("full_name", event.target.value)
                    }
                    placeholder="Your full name"
                    className={inputClass}
                  />
                </Field>
                <Field label="Email address *">
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(event) => update("email", event.target.value)}
                    placeholder="you@example.com"
                    className={inputClass}
                  />
                </Field>
                <Field label="Phone number">
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(event) => update("phone", event.target.value)}
                    placeholder="e.g. +254 700 000 000"
                    className={inputClass}
                  />
                </Field>
                <Field label="Current location">
                  <input
                    value={form.location}
                    onChange={(event) => update("location", event.target.value)}
                    placeholder="City, country"
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="How did you hear about this role?">
                <select
                  value={form.source}
                  onChange={(event) => update("source", event.target.value)}
                  className={inputClass}
                >
                  <option value="direct">Growthpad / Kazi Hire</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="referral">Referral</option>
                  <option value="job_board">Job board</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field label="CV or résumé">
                <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3.5 transition hover:border-brand-500/50 hover:bg-orange-50/40">
                  <span className="flex min-w-0 items-center gap-3">
                    <Icon
                      icon="solar:upload-minimalistic-broken"
                      className="h-5 w-5 shrink-0 text-brand-500"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-700">
                        {cvFile?.name ?? "Upload PDF or Word document"}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        Optional — it is securely parsed and automatically
                        screened
                      </span>
                    </span>
                  </span>
                  <span className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
                    Browse
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.docx"
                    className="sr-only"
                    onChange={(event) =>
                      setCvFile(event.target.files?.[0] ?? null)
                    }
                  />
                </label>
              </Field>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3.5">
                <input
                  type="checkbox"
                  required
                  checked={form.consented}
                  onChange={(event) =>
                    update("consented", event.target.checked)
                  }
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-brand-500"
                />
                <span className="text-xs leading-5 text-slate-600">
                  I consent to {company} collecting and processing my data for
                  recruitment in accordance with the Kenya Data Protection Act,
                  2019.
                </span>
              </label>
              {step === "error" && (
                <p className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">
                  {errorMsg}
                </p>
              )}
              <button
                type="submit"
                disabled={step === "uploading" || !form.consented}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:bg-brand-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon
                  icon={
                    step === "uploading"
                      ? "solar:spinner-broken"
                      : "solar:arrow-right-broken"
                  }
                  className={`h-4 w-4 ${step === "uploading" ? "animate-spin" : ""}`}
                />
                {step === "uploading"
                  ? "Sending application…"
                  : "Submit application"}
              </button>
              <p className="text-center text-[11px] leading-5 text-slate-400">
                Kazi assists our hiring workflow. A person reviews every
                application and makes every decision.
              </p>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}

function Meta({ icon, value }: { icon: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
      <Icon icon={icon} className="h-4 w-4 text-orange-200" />
      {value}
    </span>
  );
}

function SectionHeading({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
        <Icon icon={icon} className="h-4 w-4" />
      </span>
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
    </div>
  );
}

function RoleDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-orange-100 pb-3 last:border-0 last:pb-0">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function RequirementList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "emerald" | "orange";
}) {
  const colour = tone === "emerald" ? "text-emerald-600" : "text-brand-500";
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.13em] text-slate-400">
        {title}
      </p>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li
            key={item}
            className="flex gap-2.5 text-sm leading-5 text-slate-600"
          >
            <Icon
              icon={
                tone === "emerald"
                  ? "solar:check-circle-broken"
                  : "solar:star-broken"
              }
              className={`mt-0.5 h-4 w-4 shrink-0 ${colour}`}
            />
            {item}
          </li>
        ))}
      </ul>
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
    <div className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">
        {label}
      </span>
      {children}
    </div>
  );
}
