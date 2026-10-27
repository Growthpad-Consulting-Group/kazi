"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { GRANTABLE_PERMISSIONS, type GrantablePermission } from "@/lib/rbac";
import { cn } from "@/shared/lib/cn";

const ITEMS: Record<GrantablePermission, { label: string; help: string; icon: string }> = {
  view_admin_screens: {
    label: "View admin screens (read-only)",
    help: "Open Settings, Hiring and Signatures to review them. Nothing can be changed.",
    icon: "solar:eye-broken",
  },
  manage_side_quests: {
    label: "Side quests",
    help: "Create, edit and run time-bound challenges, and grant points for them.",
    icon: "solar:cup-star-broken",
  },
  manage_recognition_campaigns: {
    label: "Recognition campaigns",
    help: "Run campaigns and Hall of Fame cycles, and manage staff groups.",
    icon: "solar:flag-2-broken",
  },
};

/** Admin-only switches that give one person extra permissions on top of their role. */
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
      toast.success(next ? `${ITEMS[permission].label} granted to ${userName}` : `${ITEMS[permission].label} removed for ${userName}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update permissions.");
    } finally {
      setPending(null);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-gradient-to-r from-brand-500/10 via-brand-500/5 to-transparent px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
            <Icon icon="solar:key-minimalistic-square-broken" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold text-[var(--text-hi)]">Extra permissions</h2>
            <p className="text-xs text-[var(--text-lo)]">On top of their role. Only admins can change these.</p>
          </div>
        </div>
        <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--text-lo)]">
          {current.size} of {GRANTABLE_PERMISSIONS.length} granted
        </span>
      </div>

      <ul className="divide-y divide-[var(--border)]">
        {GRANTABLE_PERMISSIONS.map((permission) => {
          const on = current.has(permission);
          const item = ITEMS[permission];
          return (
            <li key={permission} className="flex items-center gap-4 px-5 py-4">
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", on ? "bg-brand-500/15 text-brand-500" : "bg-[var(--surface-2)] text-[var(--text-lo)]")}>
                <Icon icon={item.icon} className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--text-hi)]">{item.label}</p>
                <p className="mt-0.5 text-xs text-[var(--text-lo)]">{item.help}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`${item.label} for ${userName}`}
                disabled={pending === permission}
                onClick={() => toggle(permission)}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
                  on ? "bg-brand-500" : "bg-[var(--surface-2)] ring-1 ring-inset ring-[var(--border)]"
                )}
              >
                <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform", on ? "translate-x-5" : "translate-x-0.5")} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
