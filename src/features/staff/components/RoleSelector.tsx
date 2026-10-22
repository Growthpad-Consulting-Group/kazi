"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import type { UserRole } from "@/types/database";

const ROLES: { value: UserRole; label: string; description: string }[] = [
  { value: "admin",          label: "Admin",          description: "Full access to everything" },
  { value: "hr",             label: "HR",             description: "Staff, hiring & settings" },
  { value: "manager",        label: "Manager",        description: "Team oversight & check-ins" },
  { value: "hiring_manager", label: "Hiring Manager", description: "Post jobs & review candidates" },
  { value: "interviewer",    label: "Interviewer",    description: "Score interviews only" },
  { value: "employee",       label: "Employee",       description: "Personal pulse & goals" },
];

const BADGE: Record<UserRole, string> = {
  admin:          "bg-violet-500/10 text-violet-600",
  hr:             "bg-blue-500/10 text-blue-600",
  manager:        "bg-brand-500/10 text-brand-500",
  hiring_manager: "bg-amber-500/10 text-amber-600",
  interviewer:    "bg-sky-500/10 text-sky-600",
  employee:       "bg-slate-500/10 text-slate-500",
};

interface Props {
  userId: string;
  currentRole: UserRole;
  isSelf: boolean;
}

export function RoleSelector({ userId, currentRole, isSelf }: Props) {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>(currentRole);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();

  const current = ROLES.find((r) => r.value === role)!;

  async function select(next: UserRole) {
    if (next === role) { setOpen(false); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: userId, role: next }),
    });
    if (res.ok) {
      setRole(next);
      setOpen(false);
      startTransition(() => router.refresh());
    } else {
      const data = await res.json().catch(() => null) as { error?: string } | null;
      setError(data?.error ?? "Could not update role.");
    }
    setSaving(false);
  }

  if (isSelf) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-semibold ${BADGE[role]}`}>
        {current.label}
      </span>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={saving}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-50 ${BADGE[role]}`}
      >
        {saving ? <Icon icon="solar:spinner-broken" className="h-3 w-3 animate-spin" /> : null}
        {current.label}
        <Icon icon="solar:alt-arrow-down-broken" className="h-3 w-3" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-40 mt-1 w-64 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-black/10 dark:shadow-black/40">
            <p className="border-b border-[var(--border)] px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-lo)]">
              System access level
            </p>
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => select(r.value)}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-2)] ${r.value === role ? "bg-[var(--surface-2)]" : ""}`}
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${BADGE[r.value]}`}>
                  {r.label[0]}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-[var(--text-hi)]">{r.label}</span>
                  <span className="block text-[10px] text-[var(--text-lo)]">{r.description}</span>
                </span>
                {r.value === role && <Icon icon="solar:check-circle-broken" className="ml-auto h-4 w-4 shrink-0 text-emerald-500" />}
              </button>
            ))}
          </div>
        </>
      )}

      {error && <p className="mt-1 text-[10px] text-red-500">{error}</p>}
    </div>
  );
}
