"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";
import { useIsViewOnly } from "@/lib/use-view-only";

type WritableCompany = {
  slug: string;
  displayName: string;
};

/**
 * Keeps the aggregate Hire workspace read-only while still letting a person
 * with write access start a role in one of their authorised companies.
 */
export default function NewJobWorkspacePicker({
  companies,
  activeCompanySlug,
}: {
  companies: WritableCompany[];
  activeCompanySlug?: string;
}) {
  const router = useRouter();
  const viewOnly = useIsViewOnly();
  const [open, setOpen] = useState(false);

  if (viewOnly || companies.length === 0) return null;

  const activeCompany = activeCompanySlug
    ? companies.find((company) => company.slug === activeCompanySlug)
    : undefined;

  function openJobForm(company: WritableCompany) {
    setOpen(false);
    router.push(`/hire/jobs/new?company=${company.slug}`);
  }

  if (activeCompany) {
    return (
      <Button
        size="sm"
        icon="solar:add-circle-broken"
        className="whitespace-nowrap"
        onClick={() => openJobForm(activeCompany)}
      >
        New job
      </Button>
    );
  }

  return (
    <>
      <Button
        size="sm"
        icon="solar:add-circle-broken"
        className="whitespace-nowrap"
        onClick={() => setOpen(true)}
      >
        New job
      </Button>
      <SimpleModal
        open={open}
        onClose={() => setOpen(false)}
        title="Create a job"
        subtitle="Choose the company this role belongs to. This stays fixed while you create it."
        icon="solar:buildings-2-broken"
        maxWidth="max-w-md"
      >
        <div className="space-y-2">
          {companies.map((company) => (
            <button
              key={company.slug}
              type="button"
              onClick={() => openJobForm(company)}
              className="group flex w-full items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-left transition-all hover:border-brand-500/60 hover:bg-brand-500/5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                <Icon icon="solar:buildings-2-broken" className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[var(--text-hi)]">
                  {company.displayName}
                </span>
                <span className="mt-0.5 block text-xs text-[var(--text-lo)]">
                  Create a role in this workspace
                </span>
              </span>
              <Icon
                icon="solar:alt-arrow-right-broken"
                className="h-4 w-4 shrink-0 text-[var(--text-lo)] transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500"
              />
            </button>
          ))}
        </div>
      </SimpleModal>
    </>
  );
}
