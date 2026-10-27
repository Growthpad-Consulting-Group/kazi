"use client";

import { useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import SetPageHeader from "@/components/ui/SetPageHeader";
import SignoffBlockEditor, { type BlockEditorHandle } from "./SignoffBlockEditor";
import TemplateVersionHistory from "./TemplateVersionHistory";
import type { Block } from "@/features/signatures/lib/signoffBlocks";

type Template = { id: string; name: string; description: string | null; html: string; blocks: unknown; canvas_width: number | null };

export default function SignatureCanvasEditor({ template }: { template: Template }) {
  const router = useRouter();
  const editorRef = useRef<BlockEditorHandle>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // "Save only" stores the design. "Save and push" also re-sends it to every assigned mailbox.
  const save = async (push: boolean) => {
    const snapshot = editorRef.current?.getExport();
    if (!snapshot) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/signatures/templates/${template.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ html: snapshot.html, blocks: snapshot.blocks, canvasWidth: snapshot.canvasWidth }),
      });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error ?? "Could not save template."); }
      setSaved(true);
      if (push) {
        const pushed = await fetch(`/api/signatures/templates/${template.id}/push`, { method: "POST" });
        const result = await pushed.json().catch(() => ({})) as { error?: string; total?: number; synced?: number; failed?: number };
        if (!pushed.ok) throw new Error(result.error ?? "Saved, but the push to mailboxes failed.");
        toast.success(`Saved and pushed to ${result.synced ?? 0} of ${result.total ?? 0} mailboxes`);
        if (result.failed) toast.error(`${result.failed} mailbox${result.failed === 1 ? "" : "es"} did not update. They will be retried automatically.`);
      } else {
        toast.success("Template saved");
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save template.");
    } finally { setSaving(false); }
  };

  return <><SetPageHeader title="Signature builder" description="Design with the full Signoff block canvas." icon="solar:pen-new-square-broken" actions={[{ label: "Back to templates", icon: "solar:arrow-left-broken", variant: "secondary", href: "/signatures/templates" }]} /><section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3"><div><p className="font-semibold text-[var(--text-hi)]">{template.name}</p><p className="text-xs text-[var(--text-lo)]">Drag, nest, resize and style email-safe blocks.</p></div><div className="flex items-center gap-3">{saved && <span className="hidden items-center gap-1.5 text-xs font-medium text-emerald-600 sm:flex"><Icon icon="solar:check-circle-broken" className="h-4 w-4" />Saved</span>}<TemplateVersionHistory templateId={template.id} /><button type="button" disabled={saving} onClick={() => save(false)} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text-hi)] hover:bg-[var(--surface-2)] disabled:opacity-50"><Icon icon="solar:diskette-broken" className="h-4 w-4" />{saving ? "Saving…" : "Save only"}</button><button type="button" disabled={saving} onClick={() => save(true)} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Icon icon="solar:upload-broken" className="h-4 w-4" />{saving ? "Saving…" : "Save and push"}</button></div></header><div className="h-[calc(100vh-15rem)] min-h-[650px]"><SignoffBlockEditor ref={editorRef} templateId={template.id} initialBlocks={Array.isArray(template.blocks) ? template.blocks as Block[] : null} initialHtml={template.html} initialCanvasWidth={template.canvas_width} onChange={() => setSaved(false)} /></div></section></>;
}
