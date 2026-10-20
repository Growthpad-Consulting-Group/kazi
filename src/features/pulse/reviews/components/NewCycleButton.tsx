"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReviewCycle } from "@/types/database";

const CYCLES: ReviewCycle[] = ["quarterly", "biannual", "annual"];

export function NewCycleButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [cycle, setCycle] = useState<ReviewCycle>("quarterly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!title.trim() || !startDate || !endDate) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/pulse/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, cycle, start_date: startDate, end_date: endDate, created_by: userId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const json = await res.json();
      setOpen(false);
      router.push(`/pulse/reviews/${json.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors">
        + New Cycle
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-shadow duration-200 w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900">New Review Cycle</h2>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Cycle name *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Q3 2026 Performance Review" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Frequency</label>
              <div className="flex gap-2">
                {CYCLES.map((c) => (
                  <button key={c} type="button" onClick={() => setCycle(c)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${cycle === c ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Start date *</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">End date *</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
              </div>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={submit} disabled={saving || !title.trim() || !startDate || !endDate} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition-colors">
                {saving ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
