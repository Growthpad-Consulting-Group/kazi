"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewIdpButton({ userId, isManager }: { userId: string; isManager: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [goals, setGoals] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!title.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/pulse/idps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, manager_id: isManager ? userId : null, title, goals, due_date: dueDate || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const json = await res.json();
      setOpen(false);
      router.push(`/pulse/idps/${json.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors">
        + New Plan
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900">New Development Plan</h2>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Leadership skills development" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Goals</label>
              <textarea rows={3} value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="What do you want to achieve? By when and how will success be measured?" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Target date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={submit} disabled={saving || !title.trim()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition-colors">
                {saving ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
