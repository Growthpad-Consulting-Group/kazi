"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { GenericTable, type Column, type RowAction } from "@/components/ui/GenericTable";
import UnifiedSearchFilter, { type ActiveFilter, type FilterCategoryDef, type FilterOption } from "@/components/ui/UnifiedSearchFilter";
import StatCard, { type StatCardColor } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";
import toast from "react-hot-toast";

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
  { id: "manager", label: "Manager", icon: "solar:user-speak-broken" },
  { id: "role", label: "Role", icon: "solar:shield-user-broken" },
  { id: "location", label: "Location", icon: "solar:map-point-broken" },
];

interface Props {
  people: UserRow[];
  departments: string[];
  locations: string[];
  currentUserId: string;
  canManageStaff: boolean;
}

export default function PeopleClientView({ people, departments, locations, currentUserId, canManageStaff }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ActiveFilter[]>([]);
  const [staffToRemove, setStaffToRemove] = useState<UserRow | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");

  const closeRemoveModal = () => {
    if (removing) return;
    setStaffToRemove(null);
    setRemoveError("");
  };

  async function removeStaff() {
    if (!staffToRemove) return;
    setRemoving(true);
    setRemoveError("");
    try {
      const response = await fetch(`/api/people/${staffToRemove.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Could not remove this staff member.");
      toast.success(`${staffToRemove.name} removed from staff`);
      setStaffToRemove(null);
      router.refresh();
    } catch (cause) {
      setRemoveError(cause instanceof Error ? cause.message : "Could not remove this staff member.");
    } finally {
      setRemoving(false);
    }
  }

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

    const managerIds = new Set(people.map((person) => person.manager_id).filter((id): id is string => !!id));
    for (const f of filters) {
      if (f.category === "manager" && f.values.includes("has_direct_reports")) {
        list = f.operator === "is" ? list.filter((person) => managerIds.has(person.id)) : list.filter((person) => !managerIds.has(person.id));
      }
    }

    return list;
  }, [people, search, filters]);

  const peopleStats = useMemo(() => {
    const managers = new Set(people.map((person) => person.manager_id).filter(Boolean)).size;
    const activeDepartments = new Set(people.map((person) => person.department).filter(Boolean)).size;
    const activeLocations = new Set(people.map((person) => person.location).filter(Boolean)).size;
    return [
      { filter: [] as ActiveFilter[], label: "Staff", value: people.length, icon: "solar:users-group-two-rounded-broken", color: "blue" },
      { filter: [{ category: "department", values: departments, label: "Department: is assigned", operator: "is" as const }], label: "Departments", value: activeDepartments, icon: "solar:buildings-broken", color: "violet" },
      { filter: [{ category: "manager", values: ["has_direct_reports"], label: "Manager: has direct reports", operator: "is" as const }], label: "Managers", value: managers, icon: "solar:user-speak-broken", color: "orange" },
      { filter: [{ category: "location", values: locations, label: "Location: is assigned", operator: "is" as const }], label: "Locations", value: activeLocations, icon: "solar:map-point-broken", color: "green" },
    ] as { filter: ActiveFilter[]; label: string; value: number; icon: string; color: StatCardColor }[];
  }, [people, departments, locations]);

  const columns: Column<UserRow>[] = [
    {
      header: "Name",
      accessor: "name",
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-medium text-[var(--text-hi)]">{row.name}</div>
          <div className="text-xs text-[var(--text-lo)]">{row.email}</div>
          </div>
      ),
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
      variant: "info",
      onClick: (row) => router.push(`/pulse/checkins?user=${row.id}`),
    },
    {
      icon: "solar:chat-line-broken",
      label: "1-on-1s",
      variant: "success",
      onClick: (row) => router.push(`/pulse/one-on-ones?report=${row.id}`),
    },
    {
      icon: "solar:trash-bin-trash-broken",
      label: "Remove staff",
      variant: "danger",
      show: (row) => canManageStaff && row.id !== currentUserId,
      onClick: (row) => {
        setRemoveError("");
        setStaffToRemove(row);
      },
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {peopleStats.map((stat) => <StatCard key={stat.label} title={stat.label} value={stat.value} icon={stat.icon} color={stat.color} compact onClick={() => setFilters(stat.filter)} />)}
      </div>
      <GenericTable
      data={filtered}
      columns={columns}
      actions={actions}
      emptyMessage="No staff match your filters."
      emptyIcon="solar:user-id-broken"
      icon="solar:user-id-broken"
      unifiedSearchFilter={
        <UnifiedSearchFilter
          onSearchChange={setSearch}
          onFilterChange={setFilters}
          filterCategories={FILTER_CATEGORIES}
          categoryOptions={{ department: deptOptions, manager: [{ id: "has_direct_reports", label: "Has direct reports", category: "manager", value: "has_direct_reports" }], role: roleOptions, location: locationOptions }}
          initialFilters={filters}
          searchPlaceholder="Search by name, email, title or department…"
        />
      }
      onRefresh={() => { setSearch(""); setFilters([]); }}
      />
      <SimpleModal open={!!staffToRemove} onClose={closeRemoveModal} title="Remove staff member" icon="solar:trash-bin-trash-broken" maxWidth="max-w-md">
        <p className="text-sm leading-6 text-[var(--text-lo)]">
          Remove <span className="font-semibold text-[var(--text-hi)]">{staffToRemove?.name}</span> from active staff? They will lose access immediately and be removed from this directory. Their historical work is retained.
        </p>
        {removeError && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-600">{removeError}</p>}
        <div className="mt-5 flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button variant="secondary" disabled={removing} onClick={closeRemoveModal}>Cancel</Button>
          <Button variant="danger" icon="solar:trash-bin-trash-broken" loading={removing} onClick={removeStaff}>{removing ? "Removing" : "Remove staff"}</Button>
        </div>
      </SimpleModal>
    </div>
  );
}
