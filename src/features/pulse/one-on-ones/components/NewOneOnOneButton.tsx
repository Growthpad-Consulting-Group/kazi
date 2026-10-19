"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  managerId: string;
  reports: { id: string; name: string; job_title: string | null }[];
}

export function NewOneOnOneButton({ managerId, reports }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reportId, setReportId] = useState(reports[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function create() {
    setSaving(true);
    const res = await fetch("/api/pulse/one-on-ones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ managerId, reportId, scheduledAt: date || null }),
    });
    const json = await res.json();
    setSaving(false);
    setOpen(false);
    if (json.id) router.push(`/pulse/one-on-ones/${json.id}`);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
      >
        + Schedule 1-on-1
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900">Schedule 1-on-1</h2>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">With</label>
              <select
                value={reportId}
                onChange={(e) => setReportId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {reports.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}{r.job_title ? ` — ${r.job_title}` : ""}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Date & time (optional)</label>
              <input
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={create} disabled={saving || !reportId} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition-colors">
                {saving ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
