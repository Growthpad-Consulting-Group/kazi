"use client";

import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { SimpleModal } from "@/components/ui/SimpleModal";

type Staff = { id: string; email: string; full_name: string; role_title: string | null; department: string | null; photo_url: string | null; status: string };
type Template = { id: string; name: string; is_default: boolean };
type Assignment = { staff_profile_id: string; template_id: string; deploy_status: string; gmail_sync_status: string; last_gmail_synced_at: string | null };

export default function StaffAssignmentsClient({ staff, templates, assignments }: { staff: Staff[]; templates: Template[]; assignments: Assignment[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Staff | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncingStaffId, setSyncingStaffId] = useState<string | null>(null);
  const assignmentByStaff = useMemo(() => new Map(assignments.map((assignment) => [assignment.staff_profile_id, assignment])), [assignments]);
  const templateById = useMemo(() => new Map(templates.map((template) => [template.id, template])), [templates]);
  const rows = staff.filter((person) => `${person.full_name} ${person.email} ${person.department ?? ""}`.toLowerCase().includes(query.toLowerCase()));

  const openAssignment = (person: Staff) => { setSelected(person); setTemplateId(assignmentByStaff.get(person.id)?.template_id ?? templates.find((template) => template.is_default)?.id ?? ""); };
  const saveAssignment = async () => {
    if (!selected || !templateId) return;
    setSaving(true);
    const response = await fetch("/api/signatures/assignments/manage", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ staffProfileId: selected.id, templateId }) });
    setSaving(false);
    if (!response.ok) { const body = await response.json().catch(() => ({})); toast.error(body.error ?? "Could not save assignment."); return; }
    toast.success(`Signature assigned to ${selected.full_name}`); setSelected(null); router.refresh();
  };
  const syncGmail = async (person: Staff) => {
    setSyncingStaffId(person.id);
    try {
      const response = await fetch(`/api/signatures/staff/${person.id}/sync-gmail`, { method: "POST" });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error ?? "Could not sync Gmail."); }
      toast.success(`Signature synced to ${person.email}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sync Gmail.");
    } finally {
      setSyncingStaffId(null);
    }
  };

  return <div className="space-y-5"><SetPageHeader title="Signature staff" description="Assign and monitor the Growthpad team’s email signatures." icon="solar:users-group-rounded-broken" actions={[{ label: "Overview", icon: "solar:arrow-left-broken", variant: "secondary", href: "/signatures" }]} />
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-[var(--text-hi)]">{staff.length} Growthpad staff profiles</p><p className="mt-0.5 text-sm text-[var(--text-lo)]">Review a signature, then use Sync Gmail to deploy one approved mailbox at a time.</p></div><label className="flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 sm:w-72"><Icon icon="solar:magnifer-broken" className="h-4 w-4 text-[var(--text-lo)]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search staff" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label></div>
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="border-b border-[var(--border)] bg-[var(--surface-2)] text-[11px] font-semibold uppercase tracking-wider text-[var(--text-lo)]"><tr><th className="px-5 py-3">Staff member</th><th className="px-4 py-3">Template</th><th className="px-4 py-3">Deployment</th><th className="px-4 py-3">Gmail sync</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody>{rows.map((person) => { const assignment = assignmentByStaff.get(person.id); const template = assignment ? templateById.get(assignment.template_id) : null; const canSync = Boolean(template); return <tr key={person.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]/60"><td className="px-5 py-3.5"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f05d23]/10 text-xs font-bold text-[#f05d23]">{person.full_name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div><div><p className="text-sm font-semibold text-[var(--text-hi)]">{person.full_name}</p><p className="text-xs text-[var(--text-lo)]">{person.role_title ?? person.email}</p></div></div></td><td className="px-4 py-3.5 text-sm text-[var(--text-hi)]">{template?.name ?? <span className="text-amber-600">Unassigned</span>}</td><td className="px-4 py-3.5"><span className="rounded-full bg-slate-500/10 px-2 py-1 text-xs font-semibold capitalize text-slate-600">{assignment?.deploy_status ?? "pending"}</span></td><td className="px-4 py-3.5 text-sm text-[var(--text-lo)]">{assignment?.gmail_sync_status ?? "pending"}</td><td className="px-5 py-3.5"><div className="flex justify-end gap-2"><Link href={`/signatures/staff/${person.id}`} className="rounded-lg bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold text-[var(--text-hi)] transition-colors hover:bg-[#f05d23]/10 hover:text-[#f05d23]">Profile</Link><button onClick={() => openAssignment(person)} className="rounded-lg bg-[#f05d23]/10 px-3 py-1.5 text-xs font-semibold text-[#f05d23] transition-colors hover:bg-[#f05d23] hover:text-white">Assign</button><button disabled={!canSync || syncingStaffId === person.id} onClick={() => syncGmail(person)} className="rounded-lg bg-slate-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50">{syncingStaffId === person.id ? "Syncing…" : "Sync Gmail"}</button></div></td></tr>; })}</tbody></table></div></div>
    <SimpleModal open={!!selected} onClose={() => setSelected(null)} title={selected ? `Assign signature · ${selected.full_name}` : "Assign signature"} icon="solar:signature-broken"><div className="space-y-4"><p className="text-sm text-[var(--text-lo)]">Choose the template that should be prepared for {selected?.email}. It will not push to Gmail until the delivery rollout is approved.</p><label className="block text-sm font-medium text-[var(--text-hi)]">Signature template<select value={templateId} onChange={(event) => setTemplateId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm outline-none focus:border-[#f05d23]"><option value="">Select a template</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}{template.is_default ? " · Default" : ""}</option>)}</select></label><div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4"><button onClick={() => setSelected(null)} className="rounded-xl px-3.5 py-2 text-sm font-semibold text-[var(--text-lo)] hover:bg-[var(--surface-2)]">Cancel</button><button disabled={!templateId || saving} onClick={saveAssignment} className="rounded-xl bg-[#f05d23] px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save assignment"}</button></div></div></SimpleModal>
  </div>;
}
