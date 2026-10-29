"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";
import { DatePicker } from "@/components/ui/DatePicker";
import AvatarUpload from "@/components/ui/AvatarUpload";
import { SYSTEM_ACCESS_ROLES } from "./RoleSelector";
import type { UserRole } from "@/types/database";

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
  role: UserRole;
}

interface Props {
  userId: string;
  initial: StaffFields;
  managers: { id: string; name: string }[];
  departments: string[];
  canManageSystemAccess: boolean;
  isSelf: boolean;
  avatarFallbackUrl?: string | null;
}

const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--text-hi)] placeholder:text-[var(--text-lo)] transition-all focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";

export default function EditStaffModal({
  userId,
  initial,
  managers,
  departments,
  canManageSystemAccess,
  isSelf,
  avatarFallbackUrl,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<StaffFields>({ ...initial });
  const [isPending, startTransition] = useTransition();

  const set = <K extends keyof StaffFields>(k: K, v: StaffFields[K]) =>
    setFields((f) => ({ ...f, [k]: v }));

  function save() {
    startTransition(async () => {
      try {
        const { role, ...profileFields } = fields;
        const res = await fetch(`/api/staff/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profileFields),
        });
        const body = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Failed to save");
        if (canManageSystemAccess && role !== initial.role) {
          const roleResponse = await fetch("/api/admin/users", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: userId, role }),
          });
          const roleBody = (await roleResponse.json().catch(() => ({}))) as {
            error?: string;
          };
          if (!roleResponse.ok)
            throw new Error(roleBody.error ?? "Could not update system access");
        }
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

      <SimpleModal
        open={open}
        onClose={() => setOpen(false)}
        title="Edit staff profile"
        icon="solar:user-id-broken"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
                Full name
              </span>
              <input
                value={fields.name}
                onChange={(e) => set("name", e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
                Email
              </span>
              <input
                type="email"
                value={fields.email}
                onChange={(e) => set("email", e.target.value)}
                className={inputCls}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
                Job title
              </span>
              <input
                value={fields.job_title ?? ""}
                onChange={(e) => set("job_title", e.target.value || null)}
                placeholder="e.g. Product Designer"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
                Location
              </span>
              <input
                value={fields.location ?? ""}
                onChange={(e) => set("location", e.target.value || null)}
                placeholder="e.g. Nairobi"
                className={inputCls}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
                Department
              </span>
              <select
                value={fields.department ?? ""}
                onChange={(e) => set("department", e.target.value || null)}
                className={inputCls}
              >
                <option value="">Unassigned</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
                Manager
              </span>
              <select
                value={fields.manager_id ?? ""}
                onChange={(e) => set("manager_id", e.target.value || null)}
                className={inputCls}
              >
                <option value="">No manager</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
              Start date
            </span>
            <DatePicker
              value={fields.start_date ?? ""}
              onChange={(v) => set("start_date", v || null)}
              placeholder="Choose start date"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
              Date of birth
            </span>
            <DatePicker
              value={fields.date_of_birth ?? ""}
              onChange={(v) => set("date_of_birth", v || null)}
              placeholder="Choose date of birth"
              maxDate={new Date()}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
              Profile photo
            </span>
            <AvatarUpload
              value={fields.avatar_url ?? ""}
              previewUrl={avatarFallbackUrl ?? undefined}
              name={fields.name || "S"}
              uploadEndpoint={`/api/users/avatar?userId=${userId}`}
              onChange={(url) => set("avatar_url", url || null)}
              size="md"
            />
          </label>

          {canManageSystemAccess && (
            <section className="rounded-2xl border border-brand-500/20 bg-brand-500/[0.05] p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
                  <Icon icon="solar:shield-user-broken" className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text-hi)]">
                        System access
                      </h3>
                      <p className="mt-0.5 text-xs text-[var(--text-lo)]">
                        Controls what this person can see and do in Kazi.
                      </p>
                    </div>
                    {isSelf && (
                      <span className="rounded-lg bg-[var(--surface)] px-2 py-1 text-[10px] font-semibold text-[var(--text-lo)]">
                        Your access cannot be changed here
                      </span>
                    )}
                  </div>
                  <select
                    value={fields.role}
                    disabled={isSelf}
                    onChange={(event) =>
                      set("role", event.target.value as UserRole)
                    }
                    className={`${inputCls} mt-3 disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {SYSTEM_ACCESS_ROLES.map((accessRole) => (
                      <option key={accessRole.value} value={accessRole.value}>
                        {accessRole.label} — {accessRole.description}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-lo)] hover:bg-[var(--surface-2)]"
          >
            Cancel
          </button>
          <Button
            icon="solar:diskette-broken"
            loading={isPending}
            onClick={save}
          >
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </SimpleModal>
    </>
  );
}
