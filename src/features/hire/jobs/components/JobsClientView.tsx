"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { GenericTable, type Column, type RowAction } from "@/components/ui/GenericTable";
import UnifiedSearchFilter, { type ActiveFilter, type FilterCategoryDef, type FilterOption } from "@/components/ui/UnifiedSearchFilter";
import { StatusPill } from "@/components/ui/StatusPill";
import StatCard, { type StatCardColor } from "@/components/ui/StatCard";

interface Job extends Record<string, unknown> {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  status: string;
  created_at: string;
  published_at: string | null;
  closes_at: string | null;
}

const FILTER_CATEGORIES: FilterCategoryDef[] = [
  { id: "status", label: "Status", icon: "solar:chart-2-broken" },
  { id: "availability", label: "Availability", icon: "solar:calendar-mark-broken" },
  { id: "department", label: "Department", icon: "solar:buildings-broken" },
];

const STATUS_OPTIONS: FilterOption[] = [
  { id: "open", label: "Open", category: "status", value: "open" },
  { id: "closed", label: "Closed", category: "status", value: "closed" },
  { id: "draft", label: "Draft", category: "status", value: "draft" },
  { id: "paused", label: "Paused", category: "status", value: "paused" },
];

const AVAILABILITY_OPTIONS: FilterOption[] = [
  { id: "live", label: "Live now", category: "availability", value: "live" },
  { id: "scheduled", label: "Scheduled", category: "availability", value: "scheduled" },
  { id: "closing_soon", label: "Closing in 7 days", category: "availability", value: "closing_soon" },
];

function jobAvailability(job: Job, now: Date, nextWeek: Date) {
  const isOpen = job.status === "open";
  const published = job.published_at ? new Date(job.published_at) : null;
  const closes = job.closes_at ? new Date(job.closes_at) : null;
  return {
    live: isOpen && (!published || published <= now) && (!closes || closes > now),
    scheduled: isOpen && !!published && published > now,
    closingSoon: isOpen && !!closes && closes > now && closes <= nextWeek,
  };
}

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
    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);

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
      if (f.category === "availability") {
        const matches = (job: Job) => {
          const availability = jobAvailability(job, now, nextWeek);
          return f.values.some((value) => value === "live" ? availability.live : value === "scheduled" ? availability.scheduled : value === "closing_soon" ? availability.closingSoon : false);
        };
        list = f.operator === "is" ? list.filter(matches) : list.filter((job) => !matches(job));
      }
    }

    return list;
  }, [jobs, search, filters]);

  const jobStats = useMemo(() => {
    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const live = jobs.filter((job) => jobAvailability(job, now, nextWeek).live).length;
    const drafts = jobs.filter((job) => job.status === "draft").length;
    const scheduled = jobs.filter((job) => jobAvailability(job, now, nextWeek).scheduled).length;
    const closingSoon = jobs.filter((job) => jobAvailability(job, now, nextWeek).closingSoon).length;
    return [
      { label: "Live roles", value: live, icon: "solar:case-round-broken", color: "orange", filter: [{ category: "availability", values: ["live"], label: "Availability: is Live now", operator: "is" as const }] },
      { label: "Drafts", value: drafts, icon: "solar:document-add-broken", color: "slate", filter: [{ category: "status", values: ["draft"], label: "Status: is Draft", operator: "is" as const }] },
      { label: "Scheduled", value: scheduled, icon: "solar:calendar-mark-broken", color: "violet", filter: [{ category: "availability", values: ["scheduled"], label: "Availability: is Scheduled", operator: "is" as const }] },
      { label: "Closing in 7 days", value: closingSoon, icon: "solar:alarm-broken", color: "amber", filter: [{ category: "availability", values: ["closing_soon"], label: "Availability: is Closing in 7 days", operator: "is" as const }] },
    ];
  }, [jobs]);

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
      variant: "info",
      onClick: (row) => router.push(`/hire/jobs/${row.id}`),
    },
    {
      icon: "solar:pen-broken",
      label: "Edit",
      onClick: (row) => router.push(`/hire/jobs/${row.id}/edit`),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {jobStats.map((stat) => <StatCard key={stat.label} title={stat.label} value={stat.value} icon={stat.icon} color={stat.color as StatCardColor} compact onClick={() => setFilters(stat.filter)} />)}
      </div>
      <GenericTable
      data={filtered}
      columns={columns}
      actions={actions}
      onRowClick={(row) => router.push(`/hire/jobs/${row.id}`)}
      emptyMessage="No jobs match your filters."
      emptyIcon="solar:case-broken"
      icon="solar:case-minimalistic-broken"
      unifiedSearchFilter={
        <UnifiedSearchFilter
          onSearchChange={setSearch}
          onFilterChange={setFilters}
          filterCategories={FILTER_CATEGORIES}
          categoryOptions={{ status: STATUS_OPTIONS, availability: AVAILABILITY_OPTIONS, department: deptOptions }}
          initialFilters={filters}
          searchPlaceholder="Search jobs by title, department or location…"
        />
      }
      onRefresh={() => { setSearch(""); setFilters([]); }}
      />
    </div>
  );
}
