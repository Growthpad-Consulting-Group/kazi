"use client";

import { useState } from "react";
import { DatePicker } from "@/components/ui/DatePicker";
import { useRouter } from "next/navigation";
import type { Idp, IdpStatus } from "@/types/database";

type Action = { text: string; due_date: string | null; done: boolean };

export function IdpDetail({ idp }: { idp: Idp }) {
  const router = useRouter();
  const [title, setTitle] = useState(idp.title);
  const [goals, setGoals] = useState(idp.goals ?? "");
  const [actions, setActions] = useState<Action[]>(idp.actions ?? []);
  const [newAction, setNewAction] = useState("");
  const [newDue, setNewDue] = useState("");
  const [status, setStatus] = useState<IdpStatus>(idp.status);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/pulse/idps/${idp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, goals, actions, status }),
    });
    setSaving(false);
    router.refresh();
  }

  function addAction() {
    if (!newAction.trim()) return;
    setActions([...actions, { text: newAction.trim(), due_date: newDue || null, done: false }]);
    setNewAction("");
    setNewDue("");
  }

  function toggle(i: number) {
    setActions(actions.map((a, idx) => idx === i ? { ...a, done: !a.done } : a));
  }

  function remove(i: number) {
    setActions(actions.filter((_, idx) => idx !== i));
  }

  const STATUS_OPTIONS: IdpStatus[] = ["active", "completed", "cancelled"];
  const STATUS_STYLES: Record<IdpStatus, string> = {
    active: "bg-blue-600",
    completed: "bg-green-600",
    cancelled: "bg-slate-400",
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-2xl font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 focus:outline-none w-full"
        />
        <div className="flex gap-1.5 shrink-0">
          {STATUS_OPTIONS.map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium text-white capitalize transition-colors ${status === s ? STATUS_STYLES[s] : "bg-slate-200 text-slate-600"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow duration-200 space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Goals</h2>
        <textarea rows={4} value={goals} onChange={(e) => setGoals(e.target.value)}
          placeholder="What do you want to achieve? How will success be measured?"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow duration-200 space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Action Steps</h2>
        <div className="space-y-2">
          {actions.map((a, i) => (
            <div key={i} className="flex items-center gap-3">
              <button type="button" onClick={() => toggle(i)}
                className={`w-5 h-5 rounded border shrink-0 flex items-center justify-center transition-colors ${a.done ? "bg-green-500 border-green-500 text-white" : "border-slate-300"}`}>
                {a.done && <span className="text-xs">✓</span>}
              </button>
              <span className={`flex-1 text-sm ${a.done ? "line-through text-slate-400" : "text-slate-700"}`}>
                {a.text}
              </span>
              {a.due_date && (
                <span className="text-xs text-slate-400 shrink-0">
                  {new Date(a.due_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                </span>
              )}
              <button type="button" onClick={() => remove(i)} className="text-slate-300 hover:text-red-400 transition-colors">×</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newAction} onChange={(e) => setNewAction(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addAction()}
            placeholder="Add action step…"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
          <DatePicker value={newDue} onChange={setNewDue} className="w-full" />
          <button type="button" onClick={addAction} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors">Add</button>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition-colors">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
