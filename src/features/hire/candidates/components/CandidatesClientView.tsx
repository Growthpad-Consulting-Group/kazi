"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { GenericTable, type Column, type RowAction } from "@/components/ui/GenericTable";
import UnifiedSearchFilter, { type ActiveFilter, type FilterCategoryDef, type FilterOption } from "@/components/ui/UnifiedSearchFilter";
import { StatusPill } from "@/components/ui/StatusPill";
import type { CandidateWithJob } from "../actions";

const STAGE_FILTER_OPTIONS: FilterOption[] = [
  { id: "applied", label: "Applied", category: "stage", value: "applied" },
  { id: "screening", label: "Screening", category: "stage", value: "screening" },
  { id: "interview", label: "Interview", category: "stage", value: "interview" },
  { id: "offer", label: "Offer", category: "stage", value: "offer" },
  { id: "hired", label: "Hired", category: "stage", value: "hired" },
  { id: "rejected", label: "Rejected", category: "stage", value: "rejected" },
];

const FILTER_CATEGORIES: FilterCategoryDef[] = [
  { id: "stage", label: "Stage", icon: "solar:chart-2-broken" },
  { id: "shortlisted", label: "Shortlisted", icon: "solar:star-broken" },
];

const CATEGORY_OPTIONS: Record<string, FilterOption[]> = {
  stage: STAGE_FILTER_OPTIONS,
  shortlisted: [
    { id: "yes", label: "Yes", category: "shortlisted", value: "true" },
    { id: "no", label: "No", category: "shortlisted", value: "false" },
  ],
};

interface Props {
  candidates: CandidateWithJob[];
  unscreenedIds: string[];
}

export default function CandidatesClientView({ candidates, unscreenedIds }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ActiveFilter[]>([]);

  const filtered = useMemo(() => {
    let list = candidates;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.full_name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.jobs?.title ?? "").toLowerCase().includes(q)
      );
    }

    for (const f of filters) {
      if (f.category === "stage") {
        if (f.operator === "is") list = list.filter((c) => f.values.includes(c.stage));
        else list = list.filter((c) => !f.values.includes(c.stage));
      }
      if (f.category === "shortlisted") {
        const wantShortlisted = f.values.includes("true");
        if (f.operator === "is") list = list.filter((c) => c.shortlisted === wantShortlisted);
        else list = list.filter((c) => c.shortlisted !== wantShortlisted);
      }
    }

    return list;
  }, [candidates, search, filters]);

  const columns: Column<CandidateWithJob>[] = [
    {
      header: "Candidate",
      accessor: "full_name",
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-medium text-[var(--text-hi)]">{row.full_name}</div>
          <div className="text-xs text-[var(--text-lo)]">{row.email}</div>
        </div>
      ),
    },
    {
      header: "Role",
      accessor: "jobs.title",
      sortable: true,
      render: (row) => <span className="text-[var(--text-lo)]">{row.jobs?.title ?? "—"}</span>,
    },
    {
      header: "Stage",
      accessor: "stage",
      sortable: true,
      render: (row) => <StatusPill context="stage" value={row.stage} />,
    },
    {
      header: "AI Score",
      accessor: "ai_score",
      sortable: true,
      render: (row) =>
        row.ai_score !== null ? (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 rounded-full bg-[var(--surface-2)] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${row.ai_score}%`,
                  background:
                    row.ai_score >= 65
                      ? "linear-gradient(to right, #22c55e, #16a34a)"
                      : "linear-gradient(to right, #94a3b8, #64748b)",
                }}
              />
            </div>
            <span
              className={`text-xs font-semibold tabular-nums ${row.ai_score >= 65 ? "text-green-500" : "text-[var(--text-lo)]"}`}
            >
              {row.ai_score}
            </span>
          </div>
        ) : (
          <span className="text-xs text-[var(--text-lo)] opacity-50">—</span>
        ),
    },
    {
      header: "Shortlisted",
      accessor: "shortlisted",
      render: (row) =>
        row.shortlisted ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-500">
            <Icon icon="solar:check-circle-bold" className="h-3.5 w-3.5" /> Yes
          </span>
        ) : (
          <span className="text-xs text-[var(--text-lo)] opacity-40">—</span>
        ),
    },
    {
      header: "Applied",
      accessor: "applied_at",
      sortable: true,
      render: (row) => (
        <span className="text-xs text-[var(--text-lo)]">
          {new Date(row.applied_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
        </span>
      ),
    },
  ];

  const actions: RowAction<CandidateWithJob>[] = [
    {
      icon: "solar:eye-broken",
      label: "View",
      onClick: (row) => router.push(`/hire/candidates/${row.id}`),
    },
  ];

  return (
    <GenericTable
      data={filtered}
      columns={columns}
      actions={actions}
      onRowClick={(row) => router.push(`/hire/candidates/${row.id}`)}
      emptyMessage="No candidates match your filters."
      emptyIcon="solar:users-group-two-rounded-broken"
      icon="solar:user-speak-broken"
      unifiedSearchFilter={
        <UnifiedSearchFilter
          onSearchChange={setSearch}
          onFilterChange={setFilters}
          filterCategories={FILTER_CATEGORIES}
          categoryOptions={CATEGORY_OPTIONS}
          searchPlaceholder="Search candidates by name, email or role…"
        />
      }
      rightContent={
        unscreenedIds.length > 0 ? (
          <span className="rounded-xl border border-[#f05d23]/30 bg-[#f05d23]/5 px-3 py-1.5 text-xs font-medium text-[#f05d23]">
            {unscreenedIds.length} unscreened
          </span>
        ) : undefined
      }
    />
  );
}
