"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";
import DateRangePicker from "@/components/ui/DateRangePicker";

const toDateValue = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;

export function NewIdpButton({ userId, isManager, size = "md" }: { userId: string; isManager: boolean; size?: "sm" | "md" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [goals, setGoals] = useState("");
  const [startDate, setStartDate] = useState("");
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
        body: JSON.stringify({ user_id: userId, manager_id: isManager ? userId : null, title, goals, start_date: startDate || null, due_date: dueDate || null }),
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
      <Button size={size} icon="solar:add-circle-broken" className="rounded-lg" onClick={() => setOpen(true)}>New plan</Button>

      <SimpleModal open={open} onClose={() => setOpen(false)} title="New development plan" icon="solar:book-broken" maxWidth="max-w-md">
          <div className="space-y-4">

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
              <DateRangePicker
                value={{ startDate: startDate ? new Date(`${startDate}T12:00:00`) : null, endDate: dueDate ? new Date(`${dueDate}T12:00:00`) : null }}
                onChange={(range) => {
                  setStartDate(range.startDate ? toDateValue(range.startDate) : "");
                  setDueDate(range.endDate ? toDateValue(range.endDate) : "");
                }}
                allowedRanges={["Custom Range"]}
                maxDate={null}
                fullWidth
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={submit} disabled={saving || !title.trim()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition-colors">
                {saving ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
      </SimpleModal>
    </>
  );
}
