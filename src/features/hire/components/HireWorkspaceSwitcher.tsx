"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import type { HireCompanyAccess } from "@/lib/hire-company-access";

export default function HireWorkspaceSwitcher({
  companies,
  activeSlug,
}: {
  companies: HireCompanyAccess[];
  activeSlug: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  if (companies.length < 2) {
    return (
      <div className="hidden items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-hi)] sm:flex">
        <Icon icon="solar:buildings-2-broken" className="h-4 w-4 text-brand-500" />
        {companies[0]?.displayName}
      </div>
    );
  }

  function selectWorkspace(slug: string) {
    if (slug === activeSlug) return;
    startTransition(async () => {
      try {
        const response = await fetch("/api/hire/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company: slug }),
        });
        if (!response.ok) throw new Error("Could not switch workspace");
        const params = new URLSearchParams(searchParams.toString());
        params.set("company", slug);
        // Record-specific filters can point to a role in another workspace.
        params.delete("job");
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not switch workspace",
        );
      }
    });
  }

  return (
    <label className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-sm text-[var(--text-lo)] shadow-sm transition-colors hover:border-brand-500/50">
      <Icon icon="solar:buildings-2-broken" className="h-4 w-4 shrink-0 text-brand-500" />
      <span className="sr-only">Hire workspace</span>
      <select
        aria-label="Hire workspace"
        value={activeSlug}
        disabled={isPending}
        onChange={(event) => selectWorkspace(event.target.value)}
        className="max-w-40 cursor-pointer appearance-none bg-transparent pr-4 text-sm font-semibold text-[var(--text-hi)] outline-none disabled:cursor-wait sm:max-w-52"
      >
        {companies.map((company) => (
          <option key={company.companyId} value={company.slug}>
            {company.displayName}
          </option>
        ))}
      </select>
      <Icon icon="solar:alt-arrow-down-broken" className="pointer-events-none -ml-5 h-3.5 w-3.5 shrink-0" />
    </label>
  );
}
