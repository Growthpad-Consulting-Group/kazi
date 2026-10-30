"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";

export function QuestCompletionButton({
  questId,
  status,
  completionMode,
}: {
  questId: string;
  status?: "pending" | "approved" | "rejected";
  completionMode: "self_confirm" | "evidence_required" | "manager_approval";
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  if (status === "approved")
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
        Completed
      </span>
    );
  if (status === "pending")
    return (
      <span className="rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-700">
        Awaiting review
      </span>
    );
  async function markComplete() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/pulse/side-quests/${questId}/progress`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            evidence_note: note,
            evidence_url: url,
            evidence_file_url: fileUrl,
          }),
        },
      );
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok)
        throw new Error(data?.error ?? "Could not record completion.");
      setOpen(false);
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not record completion.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function uploadEvidence(file: File) {
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/pulse/side-quests/evidence-upload", {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as {
        url?: string;
        name?: string;
        error?: string;
      };
      if (!response.ok || !data.url)
        throw new Error(data.error ?? "Evidence upload failed.");
      setFileUrl(data.url);
      setFileName(data.name ?? file.name);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Evidence upload failed.",
      );
    } finally {
      setUploading(false);
    }
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        icon="solar:check-circle-broken"
        loading={saving}
        onClick={() =>
          completionMode === "self_confirm" ? markComplete() : setOpen(true)
        }
      >
        {saving
          ? "Saving"
          : completionMode === "self_confirm"
            ? "Mark complete"
            : "Submit for review"}
      </Button>
      {error && (
        <p className="max-w-48 text-right text-[10px] text-red-500">{error}</p>
      )}
      <SimpleModal
        open={open}
        onClose={() => setOpen(false)}
        title="Submit completion"
        icon="solar:check-circle-broken"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-lo)]">
            {completionMode === "evidence_required"
              ? "Add a short note or evidence link for review."
              : "Add an optional note or link for your manager."}
          </p>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder="What did you complete?"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
          />
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            type="url"
            placeholder="Evidence link (optional)"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
          />
          <label className="block rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-lo)] cursor-pointer">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadEvidence(file);
              }}
            />
            {uploading
              ? "Uploading evidence…"
              : fileName
                ? `Attached: ${fileName}`
                : "Attach screenshot or PDF (max 5 MB)"}
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={markComplete}>
              Submit
            </Button>
          </div>
        </div>
      </SimpleModal>
    </div>
  );
}
