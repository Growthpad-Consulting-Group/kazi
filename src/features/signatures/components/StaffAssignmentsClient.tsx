"use client";
/* eslint-disable @next/next/no-img-element -- signature staff photos may be externally hosted. */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { GenericTable, type Column, type RowAction } from "@/components/ui/GenericTable";
import UnifiedSearchFilter, { type ActiveFilter, type FilterCategoryDef, type FilterOption } from "@/components/ui/UnifiedSearchFilter";
import { SimpleModal } from "@/components/ui/SimpleModal";

type Staff = { id: string; email: string; full_name: string; role_title: string | null; department: string | null; photo_url: string | null; status: string };
type Template = { id: string; name: string; is_default: boolean };
type Assignment = { staff_profile_id: string; template_id: string; deploy_status: string; gmail_sync_status: string; last_gmail_synced_at: string | null };
type Row = Staff & { templateName: string; deliveryStatus: string; canSync: boolean; isSynced: boolean };
const FILTER_CATEGORIES: FilterCategoryDef[] = [
  { id: "department", label: "Department", icon: "solar:buildings-broken" },
  { id: "template", label: "Template", icon: "solar:document-text-broken" },
  { id: "delivery", label: "Gmail delivery", icon: "solar:letter-broken" },
];

function Avatar({ person }: { person: Staff }) {
  const initials = person.full_name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  return person.photo_url ? <img src={person.photo_url} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-xs font-bold text-brand-500">{initials}</span>;
}
function StatusPill({ status, tone = "slate" }: { status: string; tone?: "slate" | "green" | "amber" | "red" }) {
  const classes = tone === "green" ? "bg-emerald-500/10 text-emerald-600" : tone === "amber" ? "bg-amber-500/10 text-amber-600" : tone === "red" ? "bg-red-500/10 text-red-600" : "bg-slate-500/10 text-slate-600";
  return <span className={"rounded-full px-2 py-1 text-[10px] font-semibold capitalize " + classes}>{status.replaceAll("_", " ")}</span>;
}

export default function StaffAssignmentsClient({ staff, templates, assignments, initialDelivery }: { staff: Staff[]; templates: Template[]; assignments: Assignment[]; initialDelivery?: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Staff | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncingStaffId, setSyncingStaffId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ActiveFilter[]>(() => initialDelivery ? [{ category: "delivery", values: [initialDelivery], label: `Gmail delivery: is ${initialDelivery.replaceAll("_", " ")}`, operator: "is" }] : []);
  const assignmentByStaff = useMemo(() => new Map(assignments.map((item) => [item.staff_profile_id, item])), [assignments]);
  const templateById = useMemo(() => new Map(templates.map((item) => [item.id, item])), [templates]);
  const rows: Row[] = useMemo(() => staff.map((person) => {
    const assignment = assignmentByStaff.get(person.id);
    const template = assignment ? templateById.get(assignment.template_id) : null;
    const isSynced = assignment?.gmail_sync_status === "synced";
    const hasError = assignment?.gmail_sync_status === "failed" || assignment?.gmail_sync_status === "error" || assignment?.deploy_status === "failed" || assignment?.deploy_status === "error";
    const deliveryStatus = !template ? "unassigned" : isSynced ? "synced" : hasError ? "failed" : "ready to sync";
    return { ...person, templateName: template?.name ?? "Unassigned", deliveryStatus, canSync: Boolean(template), isSynced };
  }), [assignmentByStaff, staff, templateById]);
  const departmentOptions: FilterOption[] = Array.from(new Set(staff.map((person) => person.department).filter(Boolean) as string[])).sort().map((value) => ({ id: value, label: value, category: "department", value }));
  const templateOptions: FilterOption[] = Array.from(new Set(rows.map((row) => row.templateName))).sort().map((value) => ({ id: value, label: value, category: "template", value }));
  const deliveryOptions: FilterOption[] = Array.from(new Set(rows.map((row) => row.deliveryStatus))).sort().map((value) => ({ id: value, label: value.replaceAll("_", " "), category: "delivery", value }));
  const filteredRows = useMemo(() => {
    let list = rows;
    if (search.trim()) {
      const query = search.toLowerCase();
      list = list.filter((row) => [row.full_name, row.email, row.role_title, row.department, row.templateName, row.deliveryStatus].some((value) => String(value ?? "").toLowerCase().includes(query)));
    }
    for (const filter of filters) {
      const matches = (row: Row) => filter.category === "department" ? filter.values.includes(row.department ?? "") : filter.category === "template" ? filter.values.includes(row.templateName) : filter.category === "delivery" ? filter.values.includes(row.deliveryStatus) : true;
      list = filter.operator === "is" ? list.filter(matches) : list.filter((row) => !matches(row));
    }
    return list;
  }, [filters, rows, search]);
  const openAssignment = (person: Staff) => {
    setSelected(person);
    setTemplateId(assignmentByStaff.get(person.id)?.template_id ?? templates.find((item) => item.is_default)?.id ?? "");
  };
  async function saveAssignment() {
    if (!selected || !templateId) return;
    setSaving(true);
    try {
      const response = await fetch("/api/signatures/assignments/manage", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ staffProfileId: selected.id, templateId }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not save assignment.");
      toast.success("Signature assigned to " + selected.full_name);
      setSelected(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save assignment.");
    } finally { setSaving(false); }
  }
  async function syncGmail(person: Row) {
    setSyncingStaffId(person.id);
    try {
      const response = await fetch("/api/signatures/staff/" + person.id + "/sync-gmail", { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not sync Gmail.");
      toast.success("Signature synced to " + person.email);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sync Gmail.");
    } finally { setSyncingStaffId(null); }
  }
  const columns: Column<Row>[] = [
    { header: "Staff member", accessor: "full_name", sortable: true, render: (row) => <div className="flex items-center gap-3"><Avatar person={row} /><div className="min-w-0"><p className="truncate text-sm font-semibold text-[var(--text-hi)]">{row.full_name}</p><p className="truncate text-xs text-[var(--text-lo)]">{row.role_title ?? row.email}</p></div></div> },
    { header: "Department", accessor: "department", sortable: true, render: (row) => <span className="text-sm text-[var(--text-lo)]">{row.department ?? "—"}</span> },
    { header: "Template", accessor: "templateName", sortable: true, render: (row) => row.templateName === "Unassigned" ? <span className="text-sm font-medium text-amber-600">Unassigned</span> : <span className="text-sm text-[var(--text-hi)]">{row.templateName}</span> },
    { header: "Gmail delivery", accessor: "deliveryStatus", render: (row) => <StatusPill status={row.deliveryStatus} tone={row.isSynced ? "green" : row.deliveryStatus === "failed" ? "red" : row.canSync ? "amber" : "slate"} /> },
  ];
  const actions: RowAction<Row>[] = [
    { icon: "solar:user-id-broken", label: "Open profile", variant: "info", onClick: (row) => router.push("/signatures/staff/" + row.id) },
    { icon: "solar:document-add-broken", label: "Assign template", variant: "warning", onClick: openAssignment },
    { icon: (row) => syncingStaffId === row.id ? "solar:refresh-circle-broken" : row.isSynced ? "solar:check-circle-broken" : "solar:letter-broken", label: (row) => syncingStaffId === row.id ? "Syncing…" : row.isSynced ? "Sync Gmail again" : "Sync Gmail", variant: "success", show: (row) => row.canSync, onClick: syncGmail },
  ];

  return <div className="space-y-5">
    <SetPageHeader title="Signature staff" description="Assign, review, and deploy approved email signatures." icon="solar:users-group-rounded-broken" actions={[{ label: "Overview", icon: "solar:arrow-left-broken", variant: "secondary", href: "/signatures" }]} />
    <GenericTable data={filteredRows} columns={columns} actions={actions} emptyMessage="No signature staff profiles match your filters." emptyIcon="solar:users-group-rounded-broken" getRowId={(row) => row.id} onRowClick={(row) => router.push("/signatures/staff/" + row.id)} selectable={false} showExport={false} searchable={false} enableDateFilter={false} enableRefresh onRefresh={() => { setSearch(""); setFilters([]); router.refresh(); }} fullPageHeight={false} unifiedSearchFilter={<UnifiedSearchFilter onSearchChange={setSearch} onFilterChange={setFilters} filterCategories={FILTER_CATEGORIES} categoryOptions={{ department: departmentOptions, template: templateOptions, delivery: deliveryOptions }} searchPlaceholder="Search staff, email, role, department or template…" />} />
    <SimpleModal open={!!selected} onClose={() => setSelected(null)} title={selected ? "Assign signature · " + selected.full_name : "Assign signature"} icon="solar:document-add-broken">
      <div className="space-y-4"><p className="text-sm text-[var(--text-lo)]">Choose the template for {selected?.email}. It will not be pushed to Gmail until you explicitly sync it.</p><label className="block text-sm font-medium text-[var(--text-hi)]">Signature template<select value={templateId} onChange={(event) => setTemplateId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm outline-none focus:border-brand-500"><option value="">Select a template</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}{template.is_default ? " · Default" : ""}</option>)}</select></label><div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4"><button type="button" onClick={() => setSelected(null)} className="rounded-xl px-3.5 py-2 text-sm font-semibold text-[var(--text-lo)] hover:bg-[var(--surface-2)]">Cancel</button><button type="button" disabled={!templateId || saving} onClick={saveAssignment} className="rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save assignment"}</button></div></div>
    </SimpleModal>
  </div>;
}
