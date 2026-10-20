"use client";

import { useState, useTransition } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import {
  createDepartment,
  renameDepartment,
  deleteDepartment,
  type DepartmentRow,
} from "@/features/departments/actions";

const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--text-hi)] placeholder:text-[var(--text-lo)] transition-all focus:outline-none focus:border-[#f05d23] focus:ring-2 focus:ring-[#f05d23]/30";

export function DepartmentsClient({ initial }: { initial: DepartmentRow[] }) {
  const [rows, setRows] = useState(initial);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [pending, startTransition] = useTransition();

  function add() {
    const name = newName.trim();
    if (!name) return;
    startTransition(async () => {
      try {
        const saved = await createDepartment(name);
        if (rows.some((r) => r.name.toLowerCase() === saved.toLowerCase())) {
          toast.error(`"${saved}" already exists`);
          return;
        }
        // id is unknown client-side; reload to pick it up
        window.location.reload();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not add department");
      }
    });
  }

  function save(row: DepartmentRow) {
    startTransition(async () => {
      try {
        const name = await renameDepartment(row.id, editName);
        setRows((prev) =>
          prev.map((r) => (r.id === row.id ? { ...r, name } : r)).sort((a, b) => a.name.localeCompare(b.name))
        );
        setEditingId(null);
        toast.success("Department renamed");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not rename department");
      }
    });
  }

  function remove(row: DepartmentRow) {
    if (!confirm(`Delete department "${row.name}"?`)) return;
    startTransition(async () => {
      try {
        await deleteDepartment(row.id);
        setRows((prev) => prev.filter((r) => r.id !== row.id));
        toast.success("Department deleted");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not delete department");
      }
    });
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/50 hover:shadow-2xl dark:shadow-black/20 transition-shadow duration-200">
      <div className="flex gap-2 border-b border-[var(--border)] p-4">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          className={inputCls}
          placeholder="New department name"
        />
        <button
          type="button"
          onClick={add}
          disabled={pending || !newName.trim()}
          className="shrink-0 rounded-xl bg-gradient-to-r from-[#f05d23] to-[#d94f1e] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          Add
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="p-6 text-sm text-[var(--text-lo)]">No departments yet.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3 px-4 py-3">
              {editingId === row.id ? (
                <>
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") save(row);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className={inputCls}
                  />
                  <button type="button" onClick={() => save(row)} disabled={pending} className="text-xs font-semibold text-[#f05d23]">
                    Save
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="text-xs text-[var(--text-lo)]">
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-md font-semibold text-[var(--text-hi)]">{row.name}</p>
                    <p className="text-xs text-[var(--text-lo)]">
                      {row.jobs} job{row.jobs !== 1 && "s"} · {row.people} {row.people === 1 ? "person" : "people"}
                    </p>
                  </div>
                  <button
                    type="button"
                    title="Rename"
                    onClick={() => {
                      setEditingId(row.id);
                      setEditName(row.name);
                    }}
                    className="rounded-lg p-2 text-[var(--text-lo)] hover:bg-[var(--surface-2)]"
                  >
                    <Icon icon="solar:pen-broken" className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title={row.jobs + row.people > 0 ? "In use — cannot delete" : "Delete"}
                    onClick={() => remove(row)}
                    disabled={pending || row.jobs + row.people > 0}
                    className="rounded-lg p-2 text-red-500 hover:bg-red-500/10 disabled:opacity-30"
                  >
                    <Icon icon="solar:trash-bin-minimalistic-broken" className="h-4 w-4" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
