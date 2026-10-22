"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { SimpleModal } from "@/components/ui/SimpleModal";
import SignatureBlockBuilder from "./SignatureBlockBuilder";

type Template = { id: string; name: string; description: string | null; html: string; thumbnail_url: string | null; is_default: boolean; updated_at: string };

export default function TemplatesClient({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [preview, setPreview] = useState<Template | null>(null);
  const [editing, setEditing] = useState<Template | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [html, setHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const openEditor = (template: Template) => router.push(`/signatures/templates/${template.id}/edit`);
  const save = async (makeDefault = false) => {
    if (!editing || !name.trim() || !html.trim()) return;
    setSaving(true);
    const response = await fetch(`/api/signatures/templates/${editing.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, description, html, isDefault: makeDefault }) });
    setSaving(false);
    if (!response.ok) { const body = await response.json().catch(() => ({})); toast.error(body.error ?? "Could not save template."); return; }
    toast.success(makeDefault ? "Default template updated" : "Template saved"); setEditing(null); router.refresh();
  };
  return <div className="space-y-5"><SetPageHeader title="Signature templates" description="Preview the designs used across Growthpad email." icon="solar:document-text-broken" actions={[{ label: "Signature staff", icon: "solar:users-group-rounded-broken", variant: "secondary", href: "/signatures/staff" }, { label: "New template", icon: "solar:add-circle-broken", variant: "primary", href: "/signatures/templates/new" }]} />
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{templates.map((template) => <article key={template.id} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm"><div className="flex h-44 items-center justify-center bg-slate-100 p-3 dark:bg-slate-900"><div className="h-full w-full overflow-hidden rounded-lg bg-white shadow-sm"><iframe title={`${template.name} preview`} sandbox="" srcDoc={template.html} className="h-[380px] w-[720px] origin-top-left scale-[0.43] border-0" /></div></div><div className="p-4"><div className="flex items-start justify-between gap-2"><div><h2 className="font-semibold text-[var(--text-hi)]">{template.name}</h2><p className="mt-1 line-clamp-2 text-sm text-[var(--text-lo)]">{template.description ?? "Growthpad email signature template"}</p></div>{template.is_default && <span className="rounded-full bg-brand-500/10 px-2 py-1 text-[10px] font-bold text-brand-500">DEFAULT</span>}</div><div className="mt-4 flex gap-2"><button onClick={() => setPreview(template)} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500/10 px-3 py-1.5 text-xs font-semibold text-brand-500 hover:bg-brand-500 hover:text-white"><Icon icon="solar:eye-broken" className="h-3.5 w-3.5" /> Preview</button><button onClick={() => openEditor(template)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-500/10 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-500 hover:text-white"><Icon icon="solar:pen-broken" className="h-3.5 w-3.5" /> Edit</button></div></div></article>)}</div>
    <SimpleModal open={!!preview} onClose={() => setPreview(null)} title={preview?.name ?? "Template preview"} icon="solar:document-text-broken" maxWidth="max-w-4xl"><div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white"><iframe title="Email signature preview" sandbox="" srcDoc={preview?.html ?? ""} className="h-[540px] w-full border-0" /></div></SimpleModal>
    <SimpleModal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit ${editing.name}` : "Edit template"} icon="solar:pen-broken" maxWidth="max-w-4xl"><div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-[var(--text-hi)]">Name<input value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2" /></label><label className="text-sm font-medium text-[var(--text-hi)]">Description<input value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2" /></label></div><SignatureBlockBuilder initialHtml={html} onSave={async (nextHtml) => { if (!editing) return; const response = await fetch(`/api/signatures/templates/${editing.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, description, html: nextHtml }) }); if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error ?? "Could not save builder design."); } setHtml(nextHtml); toast.success("Builder design saved"); router.refresh(); }} /><details><summary className="cursor-pointer text-sm font-semibold text-[var(--text-lo)]">Advanced HTML</summary><textarea value={html} onChange={(event) => setHtml(event.target.value)} className="mt-2 min-h-40 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 font-mono text-xs" /></details><div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border)] pt-4"><button onClick={() => setEditing(null)} className="rounded-xl px-3 py-2 text-sm font-semibold text-[var(--text-lo)]">Cancel</button>{!editing?.is_default && <button disabled={saving} onClick={() => save(true)} className="rounded-xl bg-slate-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Make default</button>}<button disabled={saving} onClick={() => save()} className="rounded-xl bg-brand-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save changes"}</button></div></div></SimpleModal>
  </div>;
}
