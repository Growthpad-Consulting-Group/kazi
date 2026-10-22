"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";

interface StaffFields {
  name: string;
  email: string;
  job_title: string | null;
  department: string | null;
  location: string | null;
  manager_id: string | null;
  start_date: string | null;
  avatar_url: string | null;
}

interface Props {
  userId: string;
  initial: StaffFields;
  managers: { id: string; name: string }[];
  departments: string[];
}

const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--text-hi)] placeholder:text-[var(--text-lo)] transition-all focus:outline-none focus:border-[#f05d23] focus:ring-2 focus:ring-[#f05d23]/30";

export default function EditStaffModal({ userId, initial, managers, departments }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<StaffFields>({ ...initial });
  const [isPending, startTransition] = useTransition();

  const set = <K extends keyof StaffFields>(k: K, v: StaffFields[K]) => setFields((f) => ({ ...f, [k]: v }));

  function save() {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/staff/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fields),
        });
        const body = await res.json() as { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Failed to save");
        toast.success("Staff profile updated");
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white transition-all hover:bg-white/20 active:scale-95"
      >
        <Icon icon="solar:pen-broken" className="h-4 w-4" />
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-semibold text-[var(--text-hi)]">Edit staff profile</h2>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-[var(--text-lo)] hover:bg-[var(--surface-2)]">
                <Icon icon="solar:close-circle-broken" className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">Full name</span>
                  <input value={fields.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">Email</span>
                  <input type="email" value={fields.email} onChange={(e) => set("email", e.target.value)} className={inputCls} />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">Job title</span>
                  <input value={fields.job_title ?? ""} onChange={(e) => set("job_title", e.target.value || null)} placeholder="e.g. Product Designer" className={inputCls} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">Location</span>
                  <input value={fields.location ?? ""} onChange={(e) => set("location", e.target.value || null)} placeholder="e.g. Nairobi" className={inputCls} />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">Department</span>
                  <select value={fields.department ?? ""} onChange={(e) => set("department", e.target.value || null)} className={inputCls}>
                    <option value="">Unassigned</option>
                    {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">Manager</span>
                  <select value={fields.manager_id ?? ""} onChange={(e) => set("manager_id", e.target.value || null)} className={inputCls}>
                    <option value="">No manager</option>
                    {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">Start date</span>
                <input type="date" value={fields.start_date ?? ""} onChange={(e) => set("start_date", e.target.value || null)} className={inputCls} />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">Avatar URL</span>
                <input value={fields.avatar_url ?? ""} onChange={(e) => set("avatar_url", e.target.value || null)} placeholder="https://…" className={inputCls} />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-[var(--border)] pt-4">
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-lo)] hover:bg-[var(--surface-2)]">Cancel</button>
              <Button icon="solar:diskette-broken" loading={isPending} onClick={save}>
                {isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
