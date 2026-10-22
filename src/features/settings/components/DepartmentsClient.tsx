"use client";

import { useState, useTransition } from "react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";
import {
  createDepartment,
  renameDepartment,
  deleteDepartment,
  type DepartmentRow,
} from "@/features/departments/actions";

const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--text-hi)] placeholder:text-[var(--text-lo)] transition-all focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";

export function DepartmentsClient({ initial }: { initial: DepartmentRow[] }) {
  const [rows, setRows] = useState(initial);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [departmentToDelete, setDepartmentToDelete] = useState<DepartmentRow | null>(null);
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
    startTransition(async () => {
      try {
        await deleteDepartment(row.id);
        setRows((prev) => prev.filter((r) => r.id !== row.id));
        setDepartmentToDelete(null);
        toast.success("Department deleted");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not delete department");
      }
    });
  }

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/50 dark:shadow-black/20">
      <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[var(--text-hi)]">Department directory</p><p className="mt-0.5 text-xs text-[var(--text-lo)]">Use clear, reusable names for staff and job records.</p></div><div className="flex gap-2 sm:w-[360px]"><input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} className={inputCls} placeholder="Add department" /><Button size="sm" icon="solar:add-circle-broken" loading={pending} disabled={!newName.trim()} onClick={add}>Add</Button></div></div>

      {rows.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center px-5 text-center"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500"><Icon icon="solar:users-group-two-rounded-broken" className="h-5 w-5" /></span><p className="mt-3 text-sm font-semibold text-[var(--text-hi)]">No departments yet</p><p className="mt-1 text-xs text-[var(--text-lo)]">Add one to organize your staff and roles.</p></div>
      ) : (
        <ul className="max-h-[480px] divide-y divide-[var(--border)] overflow-y-auto">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-2)]">
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
                  <button type="button" onClick={() => save(row)} disabled={pending} className="text-xs font-semibold text-brand-500">
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
                      {row.jobs} job{row.jobs !== 1 && "s"} · {row.people} staff member{row.people === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Link href={`/departments/${row.id}`} title="Open department workspace" className="rounded-lg p-2 text-brand-500 hover:bg-brand-500/10">
                    <Icon icon="solar:arrow-right-broken" className="h-4 w-4" />
                  </Link>
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
                    onClick={() => setDepartmentToDelete(row)}
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
      <SimpleModal open={!!departmentToDelete} onClose={() => setDepartmentToDelete(null)} title="Delete department" icon="solar:trash-bin-minimalistic-broken" maxWidth="max-w-md"><p className="text-sm text-[var(--text-lo)]">Delete <strong className="text-[var(--text-hi)]">{departmentToDelete?.name}</strong>? This can only be done when the department is not used by staff or jobs.</p><div className="mt-5 flex justify-end gap-2 border-t border-[var(--border)] pt-4"><Button variant="secondary" onClick={() => setDepartmentToDelete(null)}>Cancel</Button><Button variant="danger" icon="solar:trash-bin-minimalistic-broken" loading={pending} onClick={() => departmentToDelete && remove(departmentToDelete)}>Delete department</Button></div></SimpleModal>
    </>
  );
}
