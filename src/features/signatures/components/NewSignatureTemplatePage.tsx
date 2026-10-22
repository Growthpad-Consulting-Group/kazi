"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import SetPageHeader from "@/components/ui/SetPageHeader";

export default function NewSignatureTemplatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) { toast.error("Give the template a name first."); return; }
    setCreating(true);
    try {
      const response = await fetch("/api/signatures/templates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, description }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not create template.");
      toast.success("Template created");
      router.replace(`/signatures/templates/${body.template.id}/edit`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not create template."); }
    finally { setCreating(false); }
  };
  return <div className="mx-auto max-w-2xl space-y-6"><SetPageHeader title="New signature template" description="Name the design, then build it on the full canvas." icon="solar:add-circle-broken" actions={[{ label: "Back to templates", icon: "solar:arrow-left-broken", variant: "secondary", href: "/signatures/templates" }]} /><form onSubmit={create} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500"><Icon icon="solar:document-text-broken" className="h-5 w-5" /></div><h1 className="mt-4 text-lg font-semibold text-[var(--text-hi)]">Start a signature design</h1><p className="mt-1 text-sm text-[var(--text-lo)]">The visual builder opens next, ready for your blocks, images and contact details.</p><div className="mt-6 space-y-4"><label className="block text-sm font-medium text-[var(--text-hi)]">Template name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Growthpad standard signature" className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm outline-none focus:border-brand-500" /></label><label className="block text-sm font-medium text-[var(--text-hi)]">Description <span className="font-normal text-[var(--text-lo)]">(optional)</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Who is this design for?" rows={3} className="mt-1.5 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm outline-none focus:border-brand-500" /></label></div><div className="mt-6 flex justify-end gap-2 border-t border-[var(--border)] pt-4"><button type="button" onClick={() => router.push("/signatures/templates")} className="rounded-xl px-3.5 py-2 text-sm font-semibold text-[var(--text-lo)]">Cancel</button><button type="submit" disabled={creating} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50"><Icon icon="solar:arrow-right-broken" className="h-4 w-4" />{creating ? "Creating…" : "Create and design"}</button></div></form></div>;
}
