"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";
import { DatePicker } from "@/components/ui/DatePicker";
import DepartmentSelect from "@/components/ui/DepartmentSelect";

type Manager = { id: string; name: string; job_title: string | null };
const ROLES = ["employee", "manager", "hiring_manager", "interviewer", "hr", "admin"];

export function NewPersonButton({
  departments,
  managers,
  canCreateAdmin,
  size = "sm",
}: {
  departments: string[];
  managers: Manager[];
  canCreateAdmin: boolean;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "employee", department: "", jobTitle: "", location: "", managerId: "", startDate: "" });

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function create() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Could not add this person.");
      setOpen(false);
      setForm({ name: "", email: "", password: "", role: "employee", department: "", jobTitle: "", location: "", managerId: "", startDate: "" });
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add this person.");
    } finally {
      setSaving(false);
    }
  }

  const availableRoles = canCreateAdmin ? ROLES : ROLES.filter((role) => role !== "admin");

  return (
    <>
      <Button size={size} icon="solar:add-circle-broken" className="rounded-lg" onClick={() => setOpen(true)}>
        Add staff
      </Button>
      <SimpleModal open={open} onClose={() => setOpen(false)} title="Add staff" icon="solar:user-plus-broken" maxWidth="max-w-2xl">
        <p className="text-sm text-[var(--text-lo)]">Create a staff profile and set the temporary sign-in password to share securely with them. Addresses on a configured company email domain are also added to Signature staff automatically.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Full name *"><input autoFocus value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="e.g. Amina Wanjiku" className={inputClass} /></Field>
          <Field label="Email address *"><input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="amina@company.com" className={inputClass} /></Field>
          <Field label="Temporary password *"><input type="password" value={form.password} onChange={(event) => update("password", event.target.value)} placeholder="At least 8 characters" className={inputClass} /></Field>
          <Field label="Role"><select value={form.role} onChange={(event) => update("role", event.target.value)} className={inputClass}>{availableRoles.map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}</select></Field>
          <Field label="Job title"><input value={form.jobTitle} onChange={(event) => update("jobTitle", event.target.value)} placeholder="e.g. Product Designer" className={inputClass} /></Field>
          <Field label="Department"><DepartmentSelect value={form.department} onChange={(value) => update("department", value)} departments={departments} placeholder="Select department" /></Field>
          <Field label="Manager"><select value={form.managerId} onChange={(event) => update("managerId", event.target.value)} className={inputClass}><option value="">No manager assigned</option>{managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name}{manager.job_title ? ` · ${manager.job_title}` : ""}</option>)}</select></Field>
          <Field label="Location"><input value={form.location} onChange={(event) => update("location", event.target.value)} placeholder="e.g. Nairobi, Kenya" className={inputClass} /></Field>
          <Field label="Start date"><DatePicker value={form.startDate} onChange={(value) => update("startDate", value)} placeholder="Choose date" /></Field>
        </div>
        {error && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button icon="solar:user-plus-broken" loading={saving} disabled={!form.name.trim() || !form.email.trim() || !form.password} onClick={create}>{saving ? "Adding" : "Add staff"}</Button>
        </div>
      </SimpleModal>
    </>
  );
}

const inputClass = "w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-hi)] outline-none placeholder:text-[var(--text-lo)] focus:border-[#f05d23]/60 focus:ring-2 focus:ring-[#f05d23]/10";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">{label}</span>{children}</label>;
}
