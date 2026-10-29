"use client";

import { useState } from "react";
import { GATED_PAGES, GRANTABLE_ROLES } from "@/lib/page-access";

const ROLE_LABELS: Record<(typeof GRANTABLE_ROLES)[number], string> = {
  hr: "HR",
  manager: "Manager",
  hiring_manager: "Hiring Manager",
  interviewer: "Interviewer",
  employee: "Employee",
};

export interface PageGrant {
  role: string;
  page_path: string;
}

const keyOf = (role: string, path: string) => `${role}|${path}`;

export default function PageAccessMatrix({ grants }: { grants: PageGrant[] }) {
  const [granted, setGranted] = useState(
    () => new Set(grants.map((g) => keyOf(g.role, g.page_path))),
  );
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (
    role: (typeof GRANTABLE_ROLES)[number],
    path: string,
  ) => {
    const key = keyOf(role, path);
    const next = !granted.has(key);
    setError(null);
    setPending(key);
    setGranted((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(key);
      else copy.delete(key);
      return copy;
    });

    try {
      const res = await fetch("/api/settings/page-access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, path, granted: next }),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => null))?.error ??
            "Could not save access",
        );
    } catch (err) {
      // Put the checkbox back to what the server has.
      setGranted((prev) => {
        const copy = new Set(prev);
        if (next) copy.delete(key);
        else copy.add(key);
        return copy;
      });
      setError(err instanceof Error ? err.message : "Could not save access");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-[var(--surface-2)] text-left text-xs text-[var(--text-lo)]">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Page</th>
              <th className="px-3 py-2.5 text-center font-semibold">Admin</th>
              {GRANTABLE_ROLES.map((role) => (
                <th
                  key={role}
                  className="px-3 py-2.5 text-center font-semibold"
                >
                  {ROLE_LABELS[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {GATED_PAGES.map((page) => (
              <tr key={page.path}>
                <td className="px-4 py-2.5">
                  <p className="font-medium text-[var(--text-hi)]">
                    {page.label}
                  </p>
                  <p className="font-mono text-[11px] text-[var(--text-lo)]">
                    {page.path}
                  </p>
                </td>
                <td className="px-3 py-2.5 text-center text-xs text-[var(--text-lo)]">
                  Always
                </td>
                {page.adminOnly && (
                  <td
                    colSpan={GRANTABLE_ROLES.length}
                    className="px-3 py-2.5 text-center text-xs text-[var(--text-lo)]"
                  >
                    Admin only
                  </td>
                )}
                {!page.adminOnly &&
                  GRANTABLE_ROLES.map((role) => {
                    const key = keyOf(role, page.path);
                    return (
                      <td key={role} className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          aria-label={`${ROLE_LABELS[role]} can open ${page.label}`}
                          checked={granted.has(key)}
                          disabled={pending === key}
                          onChange={() => toggle(role, page.path)}
                          className="h-4 w-4 accent-brand-500"
                        />
                      </td>
                    );
                  })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <p className="text-xs text-[var(--text-lo)]">
        Changes apply within about a minute. Each page&apos;s own permission
        checks still apply, so a page can still refuse a role that has been
        granted it.
      </p>
    </div>
  );
}
