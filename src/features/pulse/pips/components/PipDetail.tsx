"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Pip } from "@/types/database";

type Action = { text: string; due_date: string | null; done: boolean };

interface Props {
  pip: Pip;
  isManager: boolean;
  employeeName: string;
}

export function PipDetail({ pip, isManager, employeeName }: Props) {
  const router = useRouter();
  const [actions, setActions] = useState<Action[]>(pip.actions ?? []);
  const [newAction, setNewAction] = useState("");
  const [newDue, setNewDue] = useState("");
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);

  const isResolved = !!pip.resolved_at;

  async function save() {
    setSaving(true);
    await fetch(`/api/pulse/pips/${pip.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actions }),
    });
    setSaving(false);
    router.refresh();
  }

  async function resolve() {
    setResolving(true);
    await fetch(`/api/pulse/pips/${pip.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved_at: new Date().toISOString() }),
    });
    setResolving(false);
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
    if (!isManager) return;
    setActions(actions.filter((_, idx) => idx !== i));
  }

  const done = actions.filter((a) => a.done).length;
  const pct = actions.length > 0 ? Math.round((done / actions.length) * 100) : 0;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-1">Performance Improvement Plan</p>
          <h1 className="text-xl font-bold text-slate-900">{employeeName}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Started {new Date(pip.start_date).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}
            {pip.review_date && ` · Review ${new Date(pip.review_date).toLocaleDateString("en-KE", { day: "numeric", month: "long" })}`}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
          isResolved ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
        }`}>
          {isResolved ? "Resolved" : "Active"}
        </span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Performance Concern</h2>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{pip.concern}</p>
        </div>
        <div>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Expected Outcomes</h2>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{pip.expected_outcomes}</p>
        </div>
        {pip.support_provided && (
          <div>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Support Provided</h2>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{pip.support_provided}</p>
          </div>
        )}
        {pip.check_in_frequency && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-medium">Check-in Frequency:</span>
            <span>{pip.check_in_frequency}</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Action Steps</h2>
          {actions.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-slate-400">{done}/{actions.length}</span>
            </div>
          )}
        </div>
        <div className="space-y-2">
          {actions.map((a, i) => (
            <div key={i} className="flex items-center gap-3">
              <button type="button" onClick={() => toggle(i)} disabled={isResolved}
                className={`w-5 h-5 rounded border shrink-0 flex items-center justify-center transition-colors ${
                  a.done ? "bg-green-500 border-green-500 text-white" : "border-slate-300"
                } disabled:cursor-not-allowed`}>
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
              {isManager && !isResolved && (
                <button type="button" onClick={() => remove(i)} className="text-slate-300 hover:text-red-400 transition-colors">×</button>
              )}
            </div>
          ))}
        </div>
        {isManager && !isResolved && (
          <div className="flex gap-2 pt-1">
            <input value={newAction} onChange={(e) => setNewAction(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addAction()}
              placeholder="Add action step…"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
            <input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
            <button type="button" onClick={addAction}
              className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors">
              Add
            </button>
          </div>
        )}
      </div>

      {!isResolved && (
        <div className="flex justify-between">
          <button onClick={save} disabled={saving}
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition-colors">
            {saving ? "Saving…" : "Save"}
          </button>
          {isManager && (
            <button onClick={resolve} disabled={resolving}
              className="rounded-lg border border-green-300 bg-green-50 px-5 py-2.5 text-sm font-semibold text-green-700 hover:bg-green-100 disabled:opacity-50 transition-colors">
              {resolving ? "Resolving…" : "Mark Resolved"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
