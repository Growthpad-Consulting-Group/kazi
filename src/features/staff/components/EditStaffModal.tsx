"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";
import { DatePicker } from "@/components/ui/DatePicker";
import AvatarUpload from "@/components/ui/AvatarUpload";

interface StaffFields {
  name: string;
  email: string;
  job_title: string | null;
  department: string | null;
  location: string | null;
  manager_id: string | null;
  start_date: string | null;
  date_of_birth: string | null;
  avatar_url: string | null;
}

interface Props {
  userId: string;
  initial: StaffFields;
  managers: { id: string; name: string }[];
  departments: string[];
}

const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--text-hi)] placeholder:text-[var(--text-lo)] transition-all focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";

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
      <Button size="sm" icon="solar:pen-broken" onClick={() => setOpen(true)}>
        Edit staff
      </Button>

      <SimpleModal open={open} onClose={() => setOpen(false)} title="Edit staff profile" icon="solar:user-id-broken">
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
            <DatePicker value={fields.start_date ?? ""} onChange={(v) => set("start_date", v || null)} placeholder="Choose start date" />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">Date of birth</span>
            <DatePicker value={fields.date_of_birth ?? ""} onChange={(v) => set("date_of_birth", v || null)} placeholder="Choose date of birth" maxDate={new Date()} />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">Profile photo</span>
            <AvatarUpload
              value={fields.avatar_url ?? ""}
              name={fields.name || "S"}
              uploadEndpoint={`/api/users/avatar?userId=${userId}`}
              onChange={(url) => set("avatar_url", url || null)}
              size="md"
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-lo)] hover:bg-[var(--surface-2)]">
            Cancel
          </button>
          <Button icon="solar:diskette-broken" loading={isPending} onClick={save}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </SimpleModal>
    </>
  );
}
