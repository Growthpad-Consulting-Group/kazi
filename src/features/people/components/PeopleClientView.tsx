"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { GenericTable, type Column, type RowAction } from "@/components/ui/GenericTable";
import UnifiedSearchFilter, { type ActiveFilter, type FilterCategoryDef, type FilterOption } from "@/components/ui/UnifiedSearchFilter";

interface UserRow extends Record<string, unknown> {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  job_title: string | null;
  location: string | null;
  manager_id: string | null;
  manager_name?: string | null;
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-500/10 text-red-500 border-red-500/20",
  hr: "bg-pink-500/10 text-pink-500 border-pink-500/20",
  hiring_manager: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  manager: "bg-violet-500/10 text-violet-500 border-violet-500/20",
  interviewer: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  employee: "bg-[var(--surface-2)] text-[var(--text-lo)] border-[var(--border)]",
};

const FILTER_CATEGORIES: FilterCategoryDef[] = [
  { id: "department", label: "Department", icon: "solar:buildings-broken" },
  { id: "role", label: "Role", icon: "solar:shield-user-broken" },
  { id: "location", label: "Location", icon: "solar:map-point-broken" },
];

interface Props {
  people: UserRow[];
  departments: string[];
  locations: string[];
}

export default function PeopleClientView({ people, departments, locations }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ActiveFilter[]>([]);

  const deptOptions: FilterOption[] = departments.map((d) => ({
    id: d, label: d, category: "department", value: d,
  }));
  const locationOptions: FilterOption[] = locations.map((l) => ({
    id: l, label: l, category: "location", value: l,
  }));
  const roleOptions: FilterOption[] = [
    "admin", "hr", "hiring_manager", "manager", "interviewer", "employee",
  ].map((r) => ({ id: r, label: r.replace("_", " "), category: "role", value: r }));

  const filtered = useMemo(() => {
    let list = people;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          (p.job_title ?? "").toLowerCase().includes(q) ||
          (p.department ?? "").toLowerCase().includes(q)
      );
    }

    for (const f of filters) {
      if (f.category === "department") {
        if (f.operator === "is") list = list.filter((p) => f.values.includes(p.department ?? ""));
        else list = list.filter((p) => !f.values.includes(p.department ?? ""));
      }
      if (f.category === "role") {
        if (f.operator === "is") list = list.filter((p) => f.values.includes(p.role));
        else list = list.filter((p) => !f.values.includes(p.role));
      }
      if (f.category === "location") {
        if (f.operator === "is") list = list.filter((p) => f.values.includes(p.location ?? ""));
        else list = list.filter((p) => !f.values.includes(p.location ?? ""));
      }
    }

    return list;
  }, [people, search, filters]);

  const columns: Column<UserRow>[] = [
    {
      header: "Name",
      accessor: "name",
      sortable: true,
      render: (row) => {
        const initials = row.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
        const colors = ["from-orange-500 to-rose-500", "from-violet-500 to-indigo-500", "from-teal-500 to-cyan-500", "from-amber-500 to-orange-500"];
        const color = colors[row.name.charCodeAt(0) % colors.length];
        return (
          <div className="flex items-center gap-3">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br ${color} text-white text-xs font-bold`}>
              {initials}
            </div>
            <div>
              <div className="font-medium text-[var(--text-hi)]">{row.name}</div>
              <div className="text-xs text-[var(--text-lo)]">{row.email}</div>
            </div>
          </div>
        );
      },
    },
    {
      header: "Job Title",
      accessor: "job_title",
      sortable: true,
      render: (row) => <span className="text-[var(--text-lo)]">{row.job_title ?? "—"}</span>,
    },
    {
      header: "Department",
      accessor: "department",
      sortable: true,
      render: (row) => <span className="text-[var(--text-lo)]">{row.department ?? "—"}</span>,
    },
    {
      header: "Role",
      accessor: "role",
      sortable: true,
      render: (row) => (
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${ROLE_COLORS[row.role] ?? ROLE_COLORS.employee}`}>
          {row.role.replace("_", " ")}
        </span>
      ),
    },
    {
      header: "Location",
      accessor: "location",
      render: (row) => (
        <span className="text-[var(--text-lo)]">
          {row.location ? (
            <span className="flex items-center gap-1">
              <Icon icon="solar:map-point-broken" className="h-3.5 w-3.5" />
              {row.location}
            </span>
          ) : "—"}
        </span>
      ),
    },
    {
      header: "Manager",
      accessor: "manager_name",
      render: (row) => <span className="text-[var(--text-lo)]">{row.manager_name ?? "—"}</span>,
    },
  ];

  const actions: RowAction<UserRow>[] = [
    {
      icon: "solar:eye-broken",
      label: "View profile",
      onClick: (row) => router.push(`/pulse/checkins?user=${row.id}`),
    },
    {
      icon: "solar:chat-line-broken",
      label: "1-on-1s",
      onClick: (row) => router.push(`/pulse/one-on-ones?report=${row.id}`),
    },
  ];

  return (
    <GenericTable
      data={filtered}
      columns={columns}
      actions={actions}
      emptyMessage="No people match your filters."
      emptyIcon="solar:user-id-broken"
      title="Team"
      icon="solar:user-id-broken"
      unifiedSearchFilter={
        <UnifiedSearchFilter
          onSearchChange={setSearch}
          onFilterChange={setFilters}
          filterCategories={FILTER_CATEGORIES}
          categoryOptions={{ department: deptOptions, role: roleOptions, location: locationOptions }}
          searchPlaceholder="Search by name, email, title or department…"
        />
      }
      rightContent={
        <span className="text-xs text-[var(--text-lo)]">
          {filtered.length} of {people.length}
        </span>
      }
    />
  );
}
