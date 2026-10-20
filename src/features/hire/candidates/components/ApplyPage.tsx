"use client";

import { useState } from "react";

interface Props {
  jobId: string;
  jobTitle: string;
  company?: string;
}

export function ApplyPage({ jobId, jobTitle, company = "Growthpad Consulting Group" }: Props) {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    location: "",
    source: "direct",
    consented: false,
  });
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [step, setStep] = useState<"form" | "uploading" | "done" | "error">("form");
  const [errorMsg, setErrorMsg] = useState("");

  function update(k: string, v: string | boolean) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.consented) return;
    setStep("uploading");
    setErrorMsg("");

    try {
      // 1. Create candidate record
      const applyRes = await fetch("/api/hire/candidates/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, ...form }),
      });
      const applyJson = await applyRes.json();
      if (!applyRes.ok) throw new Error(applyJson.error);

      const { candidateId } = applyJson;

      // 2. Upload CV if provided
      if (cvFile && candidateId) {
        const fd = new FormData();
        fd.append("cv", cvFile);
        fd.append("candidateId", candidateId);
        fd.append("jobId", jobId);
        await fetch("/api/hire/candidates/upload-cv", { method: "POST", body: fd });
      }

      setStep("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Submission failed");
      setStep("error");
    }
  }

  if (step === "done") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="max-w-sm text-center bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 hover:shadow-2xl p-10 transition-shadow duration-200">
          <div className="text-4xl mb-4">✓</div>
          <h1 className="text-xl font-bold text-slate-900">Application received</h1>
          <p className="mt-2 text-sm text-slate-500">
            Thank you for applying to <strong>{jobTitle}</strong> at {company}. We&apos;ll be in
            touch if your profile matches our requirements.
          </p>
          <p className="mt-4 text-xs text-slate-400">
            Note: AI technology assists our screening process. All hiring decisions are made by our
            recruitment team.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="mb-8">
          <p className="text-sm text-slate-500">{company}</p>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">{jobTitle}</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 hover:shadow-2xl p-8 space-y-5 transition-shadow duration-200">
          <h2 className="font-semibold text-slate-900">Your details</h2>

          {[
            { key: "full_name", label: "Full Name *", type: "text", required: true },
            { key: "email", label: "Email Address *", type: "email", required: true },
            { key: "phone", label: "Phone Number", type: "tel", required: false },
            { key: "location", label: "Location (City, Country)", type: "text", required: false },
          ].map(({ key, label, type, required }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <input
                type={type}
                required={required}
                value={form[key as keyof typeof form] as string}
                onChange={(e) => update(key, e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          ))}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              How did you hear about this role?
            </label>
            <select
              value={form.source}
              onChange={(e) => update("source", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="direct">Direct / Company website</option>
              <option value="linkedin">LinkedIn</option>
              <option value="referral">Referral</option>
              <option value="job_board">Job board</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              CV / Resume (PDF or Word)
            </label>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setCvFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <label className="flex gap-3 items-start cursor-pointer">
            <input
              type="checkbox"
              required
              checked={form.consented}
              onChange={(e) => update("consented", e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-blue-600"
            />
            <span className="text-xs text-slate-600">
              I consent to {company} collecting and processing my personal data for recruitment
              purposes in accordance with the Kenya Data Protection Act, 2019. My data will be
              retained for up to 12 months and I may request deletion at any time.
            </span>
          </label>

          {step === "error" && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={step === "uploading" || !form.consented}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {step === "uploading" ? "Submitting…" : "Submit Application"}
          </button>

          <p className="text-xs text-slate-400 text-center">
            AI technology assists our screening process. All decisions are made by our team.
          </p>
        </form>
      </div>
    </div>
  );
}
