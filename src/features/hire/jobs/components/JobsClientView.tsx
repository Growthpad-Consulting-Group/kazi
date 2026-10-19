"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { GenericTable, type Column, type RowAction } from "@/components/ui/GenericTable";
import UnifiedSearchFilter, { type ActiveFilter, type FilterCategoryDef, type FilterOption } from "@/components/ui/UnifiedSearchFilter";
import { StatusPill } from "@/components/ui/StatusPill";

interface Job extends Record<string, unknown> {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  status: string;
  created_at: string;
}

const FILTER_CATEGORIES: FilterCategoryDef[] = [
  { id: "status", label: "Status", icon: "solar:chart-2-broken" },
  { id: "department", label: "Department", icon: "solar:buildings-broken" },
];

const STATUS_OPTIONS: FilterOption[] = [
  { id: "open", label: "Open", category: "status", value: "open" },
  { id: "closed", label: "Closed", category: "status", value: "closed" },
  { id: "draft", label: "Draft", category: "status", value: "draft" },
  { id: "paused", label: "Paused", category: "status", value: "paused" },
];

interface Props {
  jobs: Job[];
  departments: string[];
}

export default function JobsClientView({ jobs, departments }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ActiveFilter[]>([]);

  const deptOptions: FilterOption[] = departments.map((d) => ({
    id: d,
    label: d,
    category: "department",
    value: d,
  }));

  const filtered = useMemo(() => {
    let list = jobs;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          (j.department ?? "").toLowerCase().includes(q) ||
          (j.location ?? "").toLowerCase().includes(q)
      );
    }

    for (const f of filters) {
      if (f.category === "status") {
        if (f.operator === "is") list = list.filter((j) => f.values.includes(j.status));
        else list = list.filter((j) => !f.values.includes(j.status));
      }
      if (f.category === "department") {
        if (f.operator === "is") list = list.filter((j) => f.values.includes(j.department ?? ""));
        else list = list.filter((j) => !f.values.includes(j.department ?? ""));
      }
    }

    return list;
  }, [jobs, search, filters]);

  const columns: Column<Job>[] = [
    {
      header: "Role",
      accessor: "title",
      sortable: true,
      render: (row) => <span className="font-medium text-[var(--text-hi)]">{row.title}</span>,
    },
    {
      header: "Department",
      accessor: "department",
      sortable: true,
      render: (row) => <span className="text-[var(--text-lo)]">{row.department ?? "—"}</span>,
    },
    {
      header: "Location",
      accessor: "location",
      render: (row) => <span className="text-[var(--text-lo)]">{row.location ?? "—"}</span>,
    },
    {
      header: "Status",
      accessor: "status",
      sortable: true,
      render: (row) => <StatusPill context="stage" value={row.status} />,
    },
    {
      header: "Created",
      accessor: "created_at",
      sortable: true,
      render: (row) => (
        <span className="text-xs text-[var(--text-lo)]">
          {new Date(row.created_at).toLocaleDateString("en-KE", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
      ),
    },
  ];

  const actions: RowAction<Job>[] = [
    {
      icon: "solar:eye-broken",
      label: "View",
      onClick: (row) => router.push(`/hire/jobs/${row.id}`),
    },
    {
      icon: "solar:pen-broken",
      label: "Edit",
      onClick: (row) => router.push(`/hire/jobs/${row.id}/edit`),
    },
  ];

  return (
    <div className="space-y-4">
      <UnifiedSearchFilter
        onSearchChange={setSearch}
        onFilterChange={setFilters}
        filterCategories={FILTER_CATEGORIES}
        categoryOptions={{ status: STATUS_OPTIONS, department: deptOptions }}
        searchPlaceholder="Search jobs by title, department or location…"
      />

      <GenericTable
        data={filtered}
        columns={columns}
        actions={actions}
        onRowClick={(row) => router.push(`/hire/jobs/${row.id}`)}
        emptyMessage="No jobs match your filters."
        emptyIcon="solar:case-broken"
        title="Jobs"
        icon="solar:case-broken"
        rightContent={
          <a
            href="/hire/jobs/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#f05d23] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#d94f1e] transition-colors"
          >
            + New Job
          </a>
        }
      />
    </div>
  );
}
