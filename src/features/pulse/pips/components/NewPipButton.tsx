"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  directReports: { id: string; name: string }[];
  managerId: string;
}

export function NewPipButton({ directReports }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    user_id: "",
    concern: "",
    expected_outcomes: "",
    support_provided: "",
    check_in_frequency: "Weekly",
    start_date: new Date().toISOString().split("T")[0],
    review_date: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.user_id || !form.concern || !form.expected_outcomes) return;
    setSaving(true);
    const res = await fetch("/api/pulse/pips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors">
        New PIP
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">New Performance Improvement Plan</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">×</button>
            </div>
            <form onSubmit={submit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600">Employee</label>
                <select required value={form.user_id}
                  onChange={(e) => setForm({ ...form, user_id: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                  <option value="">Select employee…</option>
                  {directReports.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Performance Concern</label>
                <textarea required rows={3} value={form.concern}
                  onChange={(e) => setForm({ ...form, concern: e.target.value })}
                  placeholder="Describe the performance issue clearly and objectively…"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Expected Outcomes</label>
                <textarea required rows={3} value={form.expected_outcomes}
                  onChange={(e) => setForm({ ...form, expected_outcomes: e.target.value })}
                  placeholder="What measurable improvement is expected, and by when?"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Support Provided</label>
                <textarea rows={2} value={form.support_provided}
                  onChange={(e) => setForm({ ...form, support_provided: e.target.value })}
                  placeholder="Coaching, training, resources being offered…"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">Check-in Frequency</label>
                  <select value={form.check_in_frequency}
                    onChange={(e) => setForm({ ...form, check_in_frequency: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                    <option>Daily</option>
                    <option>Weekly</option>
                    <option>Bi-weekly</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Start Date</label>
                  <input type="date" required value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Review Date</label>
                  <input type="date" value={form.review_date}
                    onChange={(e) => setForm({ ...form, review_date: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition-colors">
                  {saving ? "Creating…" : "Create PIP"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
