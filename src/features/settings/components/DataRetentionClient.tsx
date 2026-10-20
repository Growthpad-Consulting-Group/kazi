"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Candidate = {
  id: string; full_name: string; email: string; stage: string;
  applied_at: string; jobs: { title: string } | null;
};

export function DataRetentionClient({ candidates }: { candidates: Candidate[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState(false);

  function toggleAll() {
    if (selected.size === candidates.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(candidates.map((c) => c.id)));
    }
  }

  function toggle(id: string) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  async function deleteSelected() {
    setDeleting(true);
    const res = await fetch("/api/hire/candidates/delete-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected) }),
    });
    setDeleting(false);
    setConfirm(false);
    if (res.ok) {
      setSelected(new Set());
      router.refresh();
    }
  }

  if (candidates.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-200 p-12 text-center">
        <p className="text-slate-500 font-medium">No stale records</p>
        <p className="text-xs text-slate-400 mt-1">All candidate records are within the 12-month retention window.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{candidates.length}</span> records eligible for deletion
        </p>
        {selected.size > 0 && (
          <button onClick={() => setConfirm(true)}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors">
            Delete {selected.size} selected
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="w-10 px-4 py-3">
                <input type="checkbox" checked={selected.size === candidates.length && candidates.length > 0}
                  onChange={toggleAll} className="rounded" />
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Job</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Outcome</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Applied</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.id} className={`border-b border-slate-50 last:border-0 ${selected.has(c.id) ? "bg-red-50" : "hover:bg-slate-50"}`}>
                <td className="px-4 py-3">
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="rounded" />
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">{c.full_name}</td>
                <td className="px-4 py-3 text-slate-500">{c.email}</td>
                <td className="px-4 py-3 text-slate-500">{c.jobs?.title ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                    c.stage === "hired" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                  }`}>
                    {c.stage}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(c.applied_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">Confirm Deletion</h2>
            <p className="text-sm text-slate-600">
              You are about to permanently delete <strong>{selected.size} candidate record{selected.size > 1 ? "s" : ""}</strong>,
              including their CV files and all associated data. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirm(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={deleteSelected} disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                {deleting ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
