"use client";

import { useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";
import SignoffBlockEditor, {
  type BlockEditorHandle,
} from "./SignoffBlockEditor";
import TemplateVersionHistory from "./TemplateVersionHistory";
import type { Block } from "@/features/signatures/lib/signoffBlocks";
import {
  renderPreviewHtml,
  type PreviewStaff,
} from "@/features/signatures/lib/previewStaff";

type Template = {
  id: string;
  name: string;
  description: string | null;
  html: string;
  blocks: unknown;
  canvas_width: number | null;
};
export default function SignatureCanvasEditor({
  template,
  staff,
}: {
  template: Template;
  staff: PreviewStaff[];
}) {
  const router = useRouter();
  const editorRef = useRef<BlockEditorHandle>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewStaffId, setPreviewStaffId] = useState<string>(
    staff[0]?.id ?? "",
  );
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const hasLoadedEditor = useRef(false);

  const openPreview = () =>
    setPreviewHtml(editorRef.current?.getExport().html ?? template.html);
  const previewStaff =
    staff.find((person) => person.id === previewStaffId) ?? null;

  // "Save only" stores the design. "Save and push" also re-sends it to every assigned mailbox.
  const save = async (push: boolean) => {
    const snapshot = editorRef.current?.getExport();
    if (!snapshot) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/signatures/templates/${template.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          html: snapshot.html,
          blocks: snapshot.blocks,
          canvasWidth: snapshot.canvasWidth,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not save template.");
      }
      setSaved(true);
      setHasChanges(false);
      if (push) {
        const pushed = await fetch(
          `/api/signatures/templates/${template.id}/push`,
          { method: "POST" },
        );
        const result = (await pushed.json().catch(() => ({}))) as {
          error?: string;
          total?: number;
          synced?: number;
          failed?: number;
        };
        if (!pushed.ok)
          throw new Error(
            result.error ?? "Saved, but the push to mailboxes failed.",
          );
        toast.success(
          `Saved and pushed to ${result.synced ?? 0} of ${result.total ?? 0} mailboxes`,
        );
        if (result.failed)
          toast.error(
            `${result.failed} mailbox${result.failed === 1 ? "" : "es"} did not update. They will be retried automatically.`,
          );
      } else {
        toast.success("Template saved");
      }
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save template.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SetPageHeader
        title="Signature builder"
        description="Build a reliable, email-safe signature with the full Signoff block canvas."
        icon="solar:pen-new-square-broken"
        actions={[
          {
            label: "Back to templates",
            icon: "solar:arrow-left-broken",
            variant: "secondary",
            href: "/signatures/templates",
          },
        ]}
      />
      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20">
        <header className="flex flex-col gap-4 border-b border-[var(--border)] bg-gradient-to-r from-brand-500/10 via-brand-500/[0.035] to-transparent px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
              <Icon icon="solar:pen-new-square-broken" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-semibold text-[var(--text-hi)]">
                  {template.name}
                </p>
                {saved ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-300">
                    <Icon
                      icon="solar:check-circle-broken"
                      className="h-3 w-3"
                    />
                    Saved
                  </span>
                ) : hasChanges ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-300">
                    <Icon icon="solar:pen-broken" className="h-3 w-3" />
                    Unsaved changes
                  </span>
                ) : (
                  <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-lo)]">
                    Ready to edit
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-[var(--text-lo)]">
                Add blocks on the left, select one to edit it, then save when
                ready.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              icon="solar:undo-left-round-broken"
              disabled={!canUndo}
              onClick={() => editorRef.current?.undo()}
            >
              Undo
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon="solar:undo-right-round-broken"
              disabled={!canRedo}
              onClick={() => editorRef.current?.redo()}
            >
              Redo
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon="solar:eye-broken"
              onClick={openPreview}
            >
              Preview email
            </Button>
            <TemplateVersionHistory templateId={template.id} />
            <Button
              size="sm"
              variant="secondary"
              icon="solar:diskette-broken"
              disabled={saving}
              loading={saving}
              onClick={() => save(false)}
            >
              {saving ? "Saving" : "Save"}
            </Button>
            <Button
              size="sm"
              icon="solar:upload-broken"
              disabled={saving}
              loading={saving}
              onClick={() => save(true)}
            >
              {saving ? "Saving" : "Save & sync"}
            </Button>
          </div>
        </header>
        <div className="h-[calc(100vh-16.75rem)] min-h-[650px]">
          <SignoffBlockEditor
            ref={editorRef}
            templateId={template.id}
            initialBlocks={
              Array.isArray(template.blocks)
                ? (template.blocks as Block[])
                : null
            }
            initialHtml={template.html}
            initialCanvasWidth={template.canvas_width}
            onHistoryChange={(undo, redo) => {
              setCanUndo(undo);
              setCanRedo(redo);
            }}
            onChange={() => {
              if (!hasLoadedEditor.current) {
                hasLoadedEditor.current = true;
                return;
              }
              setSaved(false);
              setHasChanges(true);
            }}
          />
        </div>
      </section>
      <SimpleModal
        open={previewHtml !== null}
        onClose={() => setPreviewHtml(null)}
        title="Email preview"
        icon="solar:eye-broken"
        maxWidth="max-w-4xl"
      >
        <div className="mb-4 flex flex-col gap-3 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-hi)]">
              Preview as staff
            </p>
            <p className="mt-1 text-xs text-[var(--text-lo)]">
              Merge fields are resolved using the selected staff profile.
            </p>
          </div>
          {staff.length ? (
            <label className="block text-xs font-medium text-[var(--text-lo)]">
              <span className="sr-only">Choose staff profile</span>
              <select
                value={previewStaffId}
                onChange={(event) => setPreviewStaffId(event.target.value)}
                className="mt-1 h-9 min-w-52 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-medium text-[var(--text-hi)] outline-none focus:border-brand-500"
              >
                {staff.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.full_name} · {person.email}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-600">
              No active staff profiles
            </span>
          )}
        </div>
        <div className="overflow-auto rounded-xl border border-[var(--border)] bg-white p-6">
          <iframe
            title="Signature email preview"
            sandbox=""
            srcDoc={renderPreviewHtml(previewHtml ?? "", previewStaff)}
            className="h-[520px] min-w-[640px] w-full border-0"
          />
        </div>
      </SimpleModal>
    </>
  );
}
