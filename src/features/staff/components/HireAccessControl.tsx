"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import type { HireCompanyRole } from "@/lib/hire-company-access";

type Company = { id: string; slug: string; displayName: string };
type Membership = { companyId: string; role: HireCompanyRole };

const ROLE_OPTIONS: {
  value: HireCompanyRole;
  label: string;
  description: string;
}[] = [
  {
    value: "viewer",
    label: "Viewer",
    description: "View the company Hire workspace.",
  },
  {
    value: "hiring_manager",
    label: "Hiring manager",
    description: "Manage roles and candidates for the company.",
  },
  {
    value: "recruiter",
    label: "Recruiter",
    description: "Run the company hiring workflow.",
  },
  {
    value: "company_admin",
    label: "Company admin",
    description: "Full Hire control for this company.",
  },
];

export function HireAccessControl({
  userId,
  userName,
  companies,
  memberships,
}: {
  userId: string;
  userName: string;
  companies: Company[];
  memberships: Membership[];
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<Record<string, HireCompanyRole>>(
    Object.fromEntries(
      memberships.map((membership) => [membership.companyId, membership.role]),
    ),
  );
  const [pending, setPending] = useState<string | null>(null);

  async function update(company: Company, value: string) {
    const next = value || null;
    setPending(company.id);
    try {
      const response = await fetch(`/api/staff/${userId}/hire-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id, role: next }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        role?: HireCompanyRole | null;
      };
      if (!response.ok)
        throw new Error(payload.error ?? "Could not update Hire access.");
      setCurrent((previous) => {
        const updated = { ...previous };
        if (payload.role) updated[company.id] = payload.role;
        else delete updated[company.id];
        return updated;
      });
      toast.success(
        payload.role
          ? `${userName} can now access ${company.displayName} Hire.`
          : `${userName}'s ${company.displayName} Hire access was removed.`,
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update Hire access.",
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] bg-gradient-to-r from-brand-500/10 via-brand-500/5 to-transparent px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
            <Icon icon="solar:buildings-2-broken" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-hi)]">
              Hire workspace access
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-lo)]">
              Choose which company hiring workspaces {userName} can open.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--text-lo)]">
          {Object.keys(current).length} assigned
        </span>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {companies.map((company) => {
          const role = current[company.id];
          const option = ROLE_OPTIONS.find((item) => item.value === role);
          return (
            <div
              key={company.id}
              className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center"
            >
              <div className="min-w-0">
                <p className="font-semibold text-[var(--text-hi)]">
                  {company.displayName}
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-lo)]">
                  {option?.description ?? "No Hire access assigned."}
                </p>
              </div>
              <select
                value={role ?? ""}
                disabled={pending === company.id}
                onChange={(event) => update(company, event.target.value)}
                aria-label={`${company.displayName} Hire role for ${userName}`}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm font-medium text-[var(--text-hi)] outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 disabled:cursor-wait disabled:opacity-60"
              >
                <option value="">No access</option>
                {ROLE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </section>
  );
}
