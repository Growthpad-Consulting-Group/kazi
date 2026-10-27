"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { GRANTABLE_PERMISSIONS, type GrantablePermission } from "@/lib/rbac";

const LABELS: Record<GrantablePermission, { label: string; help: string }> = {
  manage_side_quests: { label: "Create and run side quests", help: "Build time-bound challenges and grant points for them." },
  manage_recognition_campaigns: { label: "Run recognition campaigns", help: "Create campaigns and Hall of Fame cycles, and manage staff groups." },
};

/** Lets an admin grant a person extra permissions on top of their role. */
export function ExtraPermissionsControl({ userId, userName, granted }: { userId: string; userName: string; granted: string[] }) {
  const router = useRouter();
  const [current, setCurrent] = useState(new Set(granted));
  const [pending, setPending] = useState<string | null>(null);

  const toggle = async (permission: GrantablePermission) => {
    const next = !current.has(permission);
    setPending(permission);
    try {
      const res = await fetch(`/api/staff/${userId}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permission, granted: next }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not update permissions.");
      setCurrent((prev) => {
        const copy = new Set(prev);
        if (next) copy.add(permission);
        else copy.delete(permission);
        return copy;
      });
      toast.success(next ? `Granted to ${userName}` : `Removed from ${userName}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update permissions.");
    } finally {
      setPending(null);
    }
  };

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-[var(--text-hi)]">Extra permissions</h2>
      <p className="mt-0.5 text-xs text-[var(--text-lo)]">Granted to {userName} on top of their role. Only admins can change these.</p>
      <div className="mt-4 divide-y divide-[var(--border)]">
        {GRANTABLE_PERMISSIONS.map((permission) => (
          <label key={permission} className="flex items-center justify-between gap-4 py-3">
            <span>
              <span className="block text-sm font-medium text-[var(--text-hi)]">{LABELS[permission].label}</span>
              <span className="block text-xs text-[var(--text-lo)]">{LABELS[permission].help}</span>
            </span>
            <input
              type="checkbox"
              checked={current.has(permission)}
              disabled={pending === permission}
              onChange={() => toggle(permission)}
              className="h-4 w-4 shrink-0 accent-brand-500"
            />
          </label>
        ))}
      </div>
    </section>
  );
}
