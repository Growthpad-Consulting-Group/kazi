"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import type { UserRole } from "@/types/database";

export const SYSTEM_ACCESS_ROLES: {
  value: UserRole;
  label: string;
  description: string;
}[] = [
  { value: "admin", label: "Admin", description: "Full access to everything" },
  { value: "hr", label: "HR", description: "Staff, hiring & settings" },
  {
    value: "manager",
    label: "Manager",
    description: "Team oversight & check-ins",
  },
  {
    value: "hiring_manager",
    label: "Hiring Manager",
    description: "Post jobs & review candidates",
  },
  {
    value: "interviewer",
    label: "Interviewer",
    description: "Score interviews only",
  },
  {
    value: "employee",
    label: "Employee",
    description: "Personal pulse & goals",
  },
];

interface Props {
  userId: string;
  currentRole: UserRole;
  isSelf: boolean;
  /** Shown below the role, inside the same card. */
  footer?: React.ReactNode;
}

export function RoleSelector({ userId, currentRole, isSelf, footer }: Props) {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>(currentRole);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();

  async function select(next: UserRole) {
    if (next === role) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: userId, role: next }),
    });
    if (res.ok) {
      setRole(next);
      startTransition(() => router.refresh());
    } else {
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(data?.error ?? "Could not update role.");
    }
    setSaving(false);
  }

  const inputCls =
    "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--text-hi)] transition-all focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] bg-gradient-to-r from-brand-500/10 via-brand-500/5 to-transparent px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
            <Icon icon="solar:shield-user-broken" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-hi)]">
              System role
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-lo)]">
              Sets this person&apos;s baseline access across Kazi.
            </p>
          </div>
        </div>
        {isSelf && (
          <span className="rounded-lg bg-[var(--surface)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-lo)]">
            Your role cannot be changed here
          </span>
        )}
      </div>
      <div className="p-5">
        <label
          className="block text-xs font-semibold text-[var(--text-hi)]"
          htmlFor={`system-role-${userId}`}
        >
          Role
        </label>
        <div className="mt-1.5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
          <select
            id={`system-role-${userId}`}
            value={role}
            disabled={isSelf || saving}
            onChange={(event) => select(event.target.value as UserRole)}
            className={inputCls}
          >
            {SYSTEM_ACCESS_ROLES.map((accessRole) => (
              <option key={accessRole.value} value={accessRole.value}>
                {accessRole.label}
              </option>
            ))}
          </select>
          <div className="rounded-xl bg-[var(--surface-2)] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-lo)]">
              This role includes
            </p>
            <p className="mt-1 text-xs font-medium text-[var(--text-hi)]">
              {
                SYSTEM_ACCESS_ROLES.find(
                  (accessRole) => accessRole.value === role,
                )?.description
              }
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-[var(--text-lo)]">
          Use extra permissions below only for narrowly scoped exceptions. Role
          changes take effect immediately.
        </p>
        {error && (
          <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600">
            {error}
          </p>
        )}
      </div>
      {footer && (
        <div className="border-t border-[var(--border)] bg-[var(--surface-2)]/60 px-5 py-4">
          {footer}
        </div>
      )}
    </section>
  );
}
