/* eslint-disable @next/next/no-img-element -- signature media URLs may be hosted externally. */
"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import SetPageHeader from "@/components/ui/SetPageHeader";
import DepartmentSelect from "@/components/ui/DepartmentSelect";
import SignatureMediaPicker from "./SignatureMediaPicker";

type Profile = {
  id: string; user_id: string | null; email: string; full_name: string; role_title: string | null;
  department: string | null; phone: string | null; mobile: string | null; photo_url: string | null; status: string;
};
const inputClass = "mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-hi)] outline-none transition focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10";

export default function StaffProfileClient({ profile, departments }: { profile: Profile; departments: string[] }) {
  const router = useRouter();
  const [form, setForm] = useState(profile);
  const [saving, setSaving] = useState(false);
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const change = (key: keyof Profile, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const initials = form.full_name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  const actions = [
    { label: "Back to signature staff", icon: "solar:arrow-left-broken", variant: "secondary" as const, href: "/signatures/staff" },
    ...(profile.user_id ? [{ label: "Staff profile", icon: "solar:user-id-broken", variant: "secondary" as const, href: "/staff/" + profile.user_id + "?tab=signature" }] : []),
  ];
  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/signatures/staff/" + profile.id, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not update staff profile.");
      toast.success("Signature profile updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update staff profile.");
    } finally {
      setSaving(false);
    }
  }
  function selectPhoto(url: string) {
    change("photo_url", url);
    setPhotoPickerOpen(false);
    toast.success("Photo selected. Save the profile to apply it.");
  }

  return <div className="mx-auto max-w-7xl space-y-5">
    <SetPageHeader title={form.full_name} description="Managed identity details used in this staff member’s email signature." icon="solar:user-id-broken" actions={actions} />
    <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-start justify-between gap-3"><div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-brand-500/10 text-xl font-bold text-brand-500">{form.photo_url ? <img src={form.photo_url} alt="" className="h-full w-full object-cover" /> : initials}</div><button type="button" onClick={() => setPhotoPickerOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white"><Icon icon="solar:gallery-add-broken" className="h-4 w-4" />{form.photo_url ? "Change photo" : "Add photo"}</button></div>
          <h2 className="mt-5 text-lg font-semibold text-[var(--text-hi)]">{form.full_name}</h2><p className="mt-1 text-sm text-[var(--text-lo)]">{form.email}</p>
          <div className="mt-5 rounded-xl bg-[var(--surface-2)] p-3.5"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500"><Icon icon="solar:letter-broken" className="h-3.5 w-3.5" /></span><p className="text-sm font-semibold text-[var(--text-hi)]">Signature readiness</p></div><p className="mt-2 text-xs leading-relaxed text-[var(--text-lo)]">Photo and contact details are merged whenever this signature is synced to Gmail.</p>{profile.user_id && <Link href={"/staff/" + profile.user_id + "?tab=signature"} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-500">View staff workspace <Icon icon="solar:arrow-right-broken" className="h-3.5 w-3.5" /></Link>}</div>
        </div>
      </aside>
      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20">
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-5 py-4 sm:px-6"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500"><Icon icon="solar:pen-new-square-broken" className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold text-[var(--text-hi)]">Signature identity</h2><p className="mt-0.5 text-xs text-[var(--text-lo)]">These fields keep signature templates accurate and on-brand.</p></div></div>
        <div className="p-5 sm:p-6"><div className="grid gap-4 sm:grid-cols-2"><Field label="Full name"><input value={form.full_name} onChange={(event) => change("full_name", event.target.value)} className={inputClass} /></Field><Field label="Role title"><input value={form.role_title ?? ""} onChange={(event) => change("role_title", event.target.value)} className={inputClass} /></Field><Field label="Department"><DepartmentSelect value={form.department ?? ""} onChange={(value) => change("department", value)} departments={departments} /></Field><Field label="Status"><select value={form.status} onChange={(event) => change("status", event.target.value)} className={inputClass}><option value="active">Active</option><option value="suspended">Suspended</option></select></Field><Field label="Work phone"><input value={form.phone ?? ""} onChange={(event) => change("phone", event.target.value)} className={inputClass} /></Field><Field label="Mobile"><input value={form.mobile ?? ""} onChange={(event) => change("mobile", event.target.value)} className={inputClass} /></Field></div>
          <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-[var(--text-hi)]">Profile photo</p><p className="mt-0.5 text-xs text-[var(--text-lo)]">{form.photo_url ? "Selected from the signature media library." : "Upload a headshot or select an existing image."}</p></div><button type="button" onClick={() => setPhotoPickerOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text-hi)] hover:bg-white"><Icon icon="solar:gallery-broken" className="h-4 w-4 text-brand-500" />Manage photo</button></div>{form.photo_url && <div className="mt-3 flex items-center gap-3"><img src={form.photo_url} alt="" className="h-10 w-10 rounded-xl object-cover" /><button type="button" onClick={() => change("photo_url", "")} className="text-xs font-semibold text-red-500">Remove photo</button></div>}</div>
          <div className="mt-6 flex justify-end border-t border-[var(--border)] pt-4"><button type="button" disabled={saving} onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Icon icon="solar:diskette-broken" className="h-4 w-4" />{saving ? "Saving…" : "Save profile"}</button></div>
        </div>
      </section>
    </div>
    <SignatureMediaPicker isOpen={photoPickerOpen} onClose={() => setPhotoPickerOpen(false)} onSelect={selectPhoto} />
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-sm font-medium text-[var(--text-hi)]">{label}{children}</label>;
}
