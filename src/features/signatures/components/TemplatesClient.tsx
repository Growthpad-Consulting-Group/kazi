"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { SimpleModal } from "@/components/ui/SimpleModal";

type Template = { id: string; name: string; description: string | null; html: string; thumbnail_url: string | null; is_default: boolean; updated_at: string; link_clicks: number };

export default function TemplatesClient({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [preview, setPreview] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState<Template | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  function edit(template: Template) { router.push("/signatures/templates/" + template.id + "/edit"); }
  async function remove() {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      const response = await fetch("/api/signatures/templates/" + deleting.id, { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not delete template.");
      toast.success("Template deleted");
      setDeleting(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete template.");
    } finally { setIsDeleting(false); }
  }
  return <div className="space-y-5">
    <SetPageHeader title="Signature templates" description="Create, manage, and deploy the designs used across Growthpad email." icon="solar:document-text-broken" actions={[{ label: "Signature staff", icon: "solar:users-group-rounded-broken", variant: "secondary", href: "/signatures/staff" }, { label: "New template", icon: "solar:add-circle-broken", variant: "primary", href: "/signatures/templates/new" }]} />
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{templates.map((template) => <article key={template.id} className="group overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 transition-shadow hover:shadow-2xl dark:shadow-black/20"><div className="relative flex h-44 items-center justify-center bg-slate-100 p-3 dark:bg-slate-900"><div className="h-full w-full overflow-hidden rounded-lg bg-white shadow-sm"><iframe title={template.name + " preview"} sandbox="" srcDoc={template.html} className="h-[380px] w-[720px] origin-top-left scale-[0.43] border-0" /></div>{template.is_default && <span className="absolute left-5 top-5 rounded-full bg-brand-500 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">DEFAULT</span>}</div><div className="p-4"><div className="min-w-0"><h2 className="truncate font-semibold text-[var(--text-hi)]">{template.name}</h2><p className="mt-1 line-clamp-2 min-h-10 text-sm text-[var(--text-lo)]">{template.description ?? "Growthpad email signature template"}</p></div><div className="mt-4 flex items-center gap-2 text-xs text-[var(--text-lo)]"><span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/10 px-2.5 py-1 font-semibold text-sky-600"><Icon icon="solar:cursor-square-broken" className="h-3.5 w-3.5" />{template.link_clicks.toLocaleString()} tracked clicks</span></div><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => setPreview(template)} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500/10 px-3 py-1.5 text-xs font-semibold text-brand-500 transition-colors hover:bg-brand-500 hover:text-white"><Icon icon="solar:eye-broken" className="h-3.5 w-3.5" />Preview</button><button type="button" onClick={() => edit(template)} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold text-[var(--text-hi)] transition-colors hover:bg-slate-600 hover:text-white"><Icon icon="solar:pen-broken" className="h-3.5 w-3.5" />Edit</button><button type="button" disabled={template.is_default} onClick={() => setDeleting(template)} className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-35" title={template.is_default ? "Choose another default template before deleting this one." : "Delete template"}><Icon icon="solar:trash-bin-trash-broken" className="h-3.5 w-3.5" />Delete</button></div></div></article>)}</div>
    <SimpleModal open={!!preview} onClose={() => setPreview(null)} title={preview?.name ?? "Template preview"} icon="solar:document-text-broken" maxWidth="max-w-4xl"><div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white"><iframe title="Email signature preview" sandbox="" srcDoc={preview?.html ?? ""} className="h-[540px] w-full border-0" /></div></SimpleModal>
    <SimpleModal open={!!deleting} onClose={() => { if (!isDeleting) setDeleting(null); }} title="Delete signature template" icon="solar:trash-bin-trash-broken" maxWidth="max-w-md"><p className="text-sm leading-6 text-[var(--text-lo)]">Delete <span className="font-semibold text-[var(--text-hi)]">{deleting?.name}</span>? This removes its version history and cannot be undone. Templates assigned to staff must be reassigned first.</p><div className="mt-5 flex justify-end gap-2 border-t border-[var(--border)] pt-4"><button type="button" disabled={isDeleting} onClick={() => setDeleting(null)} className="rounded-xl px-3.5 py-2 text-sm font-semibold text-[var(--text-lo)] hover:bg-[var(--surface-2)]">Cancel</button><button type="button" disabled={isDeleting} onClick={remove} className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50"><Icon icon="solar:trash-bin-trash-broken" className="h-4 w-4" />{isDeleting ? "Deleting…" : "Delete template"}</button></div></SimpleModal>
  </div>;
}
