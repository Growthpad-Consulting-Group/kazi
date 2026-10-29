"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { SimpleModal } from "@/components/ui/SimpleModal";
import { Button } from "@/components/ui/Button";

type Candidate = {
  id: string;
  full_name: string;
  email: string;
  stage: string;
  applied_at: string;
  jobs: { title: string } | null;
};

export function DataRetentionClient({
  candidates,
}: {
  candidates: Candidate[];
}) {
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
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
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
      <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-5 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
          <Icon icon="solar:shield-check-broken" className="h-5 w-5" />
        </span>
        <p className="mt-3 text-sm font-semibold text-[var(--text-hi)]">
          No stale records
        </p>
        <p className="mt-1 text-xs text-[var(--text-lo)]">
          All candidate records are within the 12-month retention window.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
            <Icon
              icon="solar:trash-bin-minimalistic-broken"
              className="h-4 w-4"
            />
          </span>
          <div>
            <p className="text-sm font-semibold text-[var(--text-hi)]">
              Records ready for review
            </p>
            <p className="text-xs text-[var(--text-lo)]">
              <span className="font-mono font-bold text-[var(--text-hi)]">
                {candidates.length}
              </span>{" "}
              candidate records eligible for deletion
            </p>
          </div>
        </div>
        {selected.size > 0 && (
          <Button
            variant="danger"
            icon="solar:trash-bin-minimalistic-broken"
            onClick={() => setConfirm(true)}
          >
            Delete {selected.size} selected
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-2)]">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={
                      selected.size === candidates.length &&
                      candidates.length > 0
                    }
                    onChange={toggleAll}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-lo)]">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-lo)]">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-lo)]">
                  Job
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-lo)]">
                  Outcome
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-lo)]">
                  Applied
                </th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr
                  key={c.id}
                  className={`border-b border-[var(--border)] last:border-0 ${selected.has(c.id) ? "bg-red-500/5" : "hover:bg-[var(--surface-2)]"}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggle(c.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-[var(--text-hi)]">
                    {c.full_name}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-lo)]">{c.email}</td>
                  <td className="px-4 py-3 text-[var(--text-lo)]">
                    {c.jobs?.title ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        c.stage === "hired"
                          ? "bg-emerald-500/10 text-emerald-700"
                          : "bg-[var(--surface-2)] text-[var(--text-lo)]"
                      }`}
                    >
                      {c.stage}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-lo)]">
                    {new Date(c.applied_at).toLocaleDateString("en-KE", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <SimpleModal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Confirm deletion"
        icon="solar:trash-bin-trash-broken"
        maxWidth="max-w-md"
      >
        <p className="text-sm text-[var(--text-lo)]">
          You are about to permanently delete{" "}
          <strong className="text-[var(--text-hi)]">
            {selected.size} candidate record{selected.size > 1 ? "s" : ""}
          </strong>
          , including their CV files and all associated data. This cannot be
          undone.
        </p>
        <div className="mt-5 flex justify-end gap-3 border-t border-[var(--border)] pt-4">
          <Button variant="secondary" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            icon="solar:trash-bin-minimalistic-broken"
            loading={deleting}
            onClick={deleteSelected}
          >
            {deleting ? "Deleting" : "Delete permanently"}
          </Button>
        </div>
      </SimpleModal>
    </div>
  );
}
