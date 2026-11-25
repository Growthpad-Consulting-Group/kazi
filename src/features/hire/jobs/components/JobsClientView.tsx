"use client";

import { useState, useMemo, useTransition } from "react";
import { publicJobUrl } from "@/lib/careers-url";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { updateJob } from "../actions";
import { displayJobStatus } from "../types";
import {
  GenericTable,
  type Column,
  type RowAction,
} from "@/components/ui/GenericTable";
import UnifiedSearchFilter, {
  type ActiveFilter,
  type FilterCategoryDef,
  type FilterOption,
} from "@/components/ui/UnifiedSearchFilter";
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
  applicants: number;
  shortlisted: number;
}

const FILTER_CATEGORIES: FilterCategoryDef[] = [
  { id: "status", label: "Status", icon: "solar:chart-2-broken" },
  {
    id: "availability",
    label: "Availability",
    icon: "solar:calendar-mark-broken",
  },
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
  {
    id: "scheduled",
    label: "Scheduled",
    category: "availability",
    value: "scheduled",
  },
  {
    id: "closing_soon",
    label: "Closing in 7 days",
    category: "availability",
    value: "closing_soon",
  },
];

function jobAvailability(job: Job, now: Date, nextWeek: Date) {
  const isOpen = job.status === "open";
  const published = job.published_at ? new Date(job.published_at) : null;
  const closes = job.closes_at ? new Date(job.closes_at) : null;
  return {
    live:
      isOpen && (!published || published <= now) && (!closes || closes > now),
    scheduled: isOpen && !!published && published > now,
    closingSoon: isOpen && !!closes && closes > now && closes <= nextWeek,
  };
}

interface Props {
  jobs: Job[];
  departments: string[];
  companySlug?: string;
  initialStatus?: string;
  readOnly?: boolean;
}

export default function JobsClientView({
  jobs,
  departments,
  companySlug,
  initialStatus,
  readOnly = false,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ActiveFilter[]>(() =>
    STATUS_OPTIONS.some((option) => option.value === initialStatus)
      ? [
          {
            category: "status",
            values: [initialStatus!],
            label: `Status: is ${initialStatus}`,
            operator: "is",
          },
        ]
      : [],
  );

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
          (j.location ?? "").toLowerCase().includes(q),
      );
    }

    for (const f of filters) {
      if (f.category === "status") {
        if (f.operator === "is")
          list = list.filter((j) => f.values.includes(displayJobStatus(j)));
        else list = list.filter((j) => !f.values.includes(displayJobStatus(j)));
      }
      if (f.category === "department") {
        if (f.operator === "is")
          list = list.filter((j) => f.values.includes(j.department ?? ""));
        else list = list.filter((j) => !f.values.includes(j.department ?? ""));
      }
      if (f.category === "availability") {
        const matches = (job: Job) => {
          const availability = jobAvailability(job, now, nextWeek);
          return f.values.some((value) =>
            value === "live"
              ? availability.live
              : value === "scheduled"
                ? availability.scheduled
                : value === "closing_soon"
                  ? availability.closingSoon
                  : false,
          );
        };
        list =
          f.operator === "is"
            ? list.filter(matches)
            : list.filter((job) => !matches(job));
      }
    }

    return list;
  }, [jobs, search, filters]);

  const jobStats = useMemo(() => {
    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const live = jobs.filter(
      (job) => jobAvailability(job, now, nextWeek).live,
    ).length;
    const drafts = jobs.filter((job) => job.status === "draft").length;
    const scheduled = jobs.filter(
      (job) => jobAvailability(job, now, nextWeek).scheduled,
    ).length;
    const closingSoon = jobs.filter(
      (job) => jobAvailability(job, now, nextWeek).closingSoon,
    ).length;
    return [
      {
        label: "Live roles",
        value: live,
        icon: "solar:case-round-broken",
        color: "orange",
        filter: [
          {
            category: "availability",
            values: ["live"],
            label: "Availability: is Live now",
            operator: "is" as const,
          },
        ],
      },
      {
        label: "Drafts",
        value: drafts,
        icon: "solar:document-add-broken",
        color: "slate",
        filter: [
          {
            category: "status",
            values: ["draft"],
            label: "Status: is Draft",
            operator: "is" as const,
          },
        ],
      },
      {
        label: "Scheduled",
        value: scheduled,
        icon: "solar:calendar-mark-broken",
        color: "blue",
        filter: [
          {
            category: "availability",
            values: ["scheduled"],
            label: "Availability: is Scheduled",
            operator: "is" as const,
          },
        ],
      },
      {
        label: "Closing in 7 days",
        value: closingSoon,
        icon: "solar:alarm-broken",
        color: "amber",
        filter: [
          {
            category: "availability",
            values: ["closing_soon"],
            label: "Availability: is Closing in 7 days",
            operator: "is" as const,
          },
        ],
      },
    ];
  }, [jobs]);

  const columns: Column<Job>[] = [
    {
      header: "Role",
      accessor: "title",
      sortable: true,
      render: (row) => (
        <span className="font-medium text-[var(--text-hi)]">{row.title}</span>
      ),
    },
    {
      header: "Department",
      accessor: "department",
      sortable: true,
      render: (row) => (
        <span className="text-[var(--text-lo)]">{row.department ?? "—"}</span>
      ),
    },
    {
      header: "Location",
      accessor: "location",
      render: (row) => (
        <span className="text-[var(--text-lo)]">{row.location ?? "—"}</span>
      ),
    },
    {
      header: "Status",
      accessor: "status",
      sortable: true,
      render: (row) => (
        <StatusPill context="stage" value={displayJobStatus(row)} />
      ),
    },
    {
      header: "Applicants",
      accessor: "applicants",
      sortable: true,
      render: (row) => (
        <div>
          <span className="font-medium text-[var(--text-hi)]">
            {row.applicants}
          </span>
          <p className="text-xs text-[var(--text-lo)]">
            {row.shortlisted} shortlisted
          </p>
        </div>
      ),
    },
    {
      header: "Deadline",
      accessor: "closes_at",
      sortable: true,
      render: (row) =>
        row.closes_at ? (
          <span className="text-xs text-[var(--text-lo)]">
            {new Date(row.closes_at).toLocaleDateString("en-KE", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        ) : (
          <span className="text-xs italic text-[var(--text-lo)]">
            Open-ended
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
    {
      icon: "solar:global-broken",
      label: "Open careers page",
      variant: "success",
      show: (row) => jobAvailability(row, new Date(), new Date()).live,
      onClick: (row) =>
        window.open(
          publicJobUrl(String(row.slug), companySlug),
          "_blank",
          "noopener,noreferrer",
        ),
    },
    {
      icon: "solar:pause-circle-broken",
      label: "Pause job",
      variant: "warning",
      show: (row) => row.status === "open",
      onClick: (row) => {
        startTransition(async () => {
          try {
            await updateJob(row.id, { status: "paused" });
            toast.success("Job paused and removed from public careers pages");
            router.refresh();
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Could not pause job",
            );
          }
        });
      },
    },
    {
      icon: "solar:play-circle-broken",
      label: "Resume job",
      variant: "success",
      show: (row) => row.status === "paused",
      onClick: (row) => {
        startTransition(async () => {
          try {
            await updateJob(row.id, { status: "open" });
            toast.success("Job resumed and is accepting applications");
            router.refresh();
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Could not resume job",
            );
          }
        });
      },
    },
  ];

  const pauseJob = (job: Job) => {
    startTransition(async () => {
      try {
        await updateJob(job.id, { status: "paused" });
        toast.success("Job paused and removed from public careers pages");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not pause job",
        );
      }
    });
  };

  const resumeJob = (job: Job) => {
    startTransition(async () => {
      try {
        await updateJob(job.id, { status: "open" });
        toast.success("Job resumed and is accepting applications");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not resume job",
        );
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {jobStats.map((stat) => (
          <StatCard
            variant="inline"
            key={stat.label}
            title={stat.label}
            value={stat.value}
            icon={stat.icon}
            color={stat.color as StatCardColor}
            compact
            onClick={() => setFilters(stat.filter)}
          />
        ))}
      </div>
      <GenericTable
        data={filtered}
        columns={columns}
        actions={readOnly ? [] : actions}
        selectable={!readOnly}
        onRowClick={(row) => router.push(`/hire/jobs/${row.id}`)}
        mobileCard={(job) => (
          <article
            role="button"
            tabIndex={0}
            onClick={() => router.push(`/hire/jobs/${job.id}`)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                router.push(`/hire/jobs/${job.id}`);
              }
            }}
            className="space-y-3 px-4 py-4 transition-colors active:bg-brand-500/5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-[var(--text-hi)]">
                  {job.title}
                </h2>
                <p className="mt-1 truncate text-xs text-[var(--text-lo)]">
                  {[job.department, job.location].filter(Boolean).join(" · ") ||
                    "No department or location"}
                </p>
              </div>
              <StatusPill context="stage" value={displayJobStatus(job)} />
            </div>

            <div className="flex items-center gap-4 text-xs text-[var(--text-lo)]">
              <span className="inline-flex items-center gap-1.5">
                <Icon
                  icon="solar:users-group-rounded-broken"
                  className="h-4 w-4"
                />
                <strong className="font-semibold text-[var(--text-hi)]">
                  {job.applicants}
                </strong>
                applicants
              </span>
              <span>
                {job.closes_at
                  ? `Closes ${new Date(job.closes_at).toLocaleDateString(
                      "en-KE",
                      {
                        day: "numeric",
                        month: "short",
                      },
                    )}`
                  : "Open-ended"}
              </span>
            </div>

            <div
              className="flex items-center gap-2"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => router.push(`/hire/jobs/${job.id}`)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text-hi)] transition-colors hover:border-brand-500/50"
              >
                <Icon icon="solar:eye-broken" className="h-4 w-4" />
                View role
              </button>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => router.push(`/hire/jobs/${job.id}/edit`)}
                  aria-label={`Edit ${job.title}`}
                  className="rounded-xl bg-brand-500/10 p-2 text-brand-500 transition-colors hover:bg-brand-500/20"
                >
                  <Icon icon="solar:pen-broken" className="h-4 w-4" />
                </button>
              )}
              {!readOnly && job.status === "open" && (
                <button
                  type="button"
                  onClick={() => pauseJob(job)}
                  aria-label={`Pause ${job.title}`}
                  className="rounded-xl bg-amber-500/15 p-2 text-amber-600 transition-colors hover:bg-amber-500/25"
                >
                  <Icon icon="solar:pause-circle-broken" className="h-4 w-4" />
                </button>
              )}
              {!readOnly && job.status === "paused" && (
                <button
                  type="button"
                  onClick={() => resumeJob(job)}
                  aria-label={`Resume ${job.title}`}
                  className="rounded-xl bg-green-500/10 p-2 text-green-600 transition-colors hover:bg-green-500/20"
                >
                  <Icon icon="solar:play-circle-broken" className="h-4 w-4" />
                </button>
              )}
            </div>
          </article>
        )}
        emptyMessage="No jobs match your filters."
        emptyIcon="solar:case-broken"
        icon="solar:case-minimalistic-broken"
        unifiedSearchFilter={
          <UnifiedSearchFilter
            onSearchChange={setSearch}
            onFilterChange={setFilters}
            filterCategories={FILTER_CATEGORIES}
            categoryOptions={{
              status: STATUS_OPTIONS,
              availability: AVAILABILITY_OPTIONS,
              department: deptOptions,
            }}
            initialFilters={filters}
            searchPlaceholder="Search jobs by title, department or location…"
          />
        }
        onRefresh={() => {
          setSearch("");
          setFilters([]);
        }}
      />
    </div>
  );
}
