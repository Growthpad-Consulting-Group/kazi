"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";

export function QuestCompletionButton({
  questId,
  questTitle,
  completionCriteria,
  status,
  completionMode,
}: {
  questId: string;
  questTitle: string;
  completionCriteria: string;
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
  const [fileIsImage, setFileIsImage] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
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
      setFileIsImage(file.type.startsWith("image/"));
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
        title={`Complete: ${questTitle}`}
        subtitle="Your submission stays pending until it is reviewed."
        icon="solar:check-circle-broken"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-brand-500/15 bg-brand-500/[0.05] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-600">
              Completion criteria
            </p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--text-hi)]">
              {completionCriteria}
            </p>
          </div>
          <p className="text-sm text-[var(--text-lo)]">
            Add a concise summary and supporting proof for the reviewer.
          </p>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder={`How did you complete ${questTitle}?`}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
          />
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            type="url"
            placeholder="Evidence link (optional)"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
          />
          <label
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files?.[0];
              if (file) void uploadEvidence(file);
            }}
            className={`block cursor-pointer rounded-xl border border-dashed px-3 py-3 text-sm transition-colors ${dragging ? "border-brand-500 bg-brand-500/10 text-brand-600" : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-lo)]"}`}
          >
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadEvidence(file);
              }}
            />
            {uploading ? (
              <span className="inline-flex items-center gap-2">
                <Icon
                  icon="solar:spinner-broken"
                  className="h-4 w-4 animate-spin"
                />
                Uploading evidence…
              </span>
            ) : fileName ? (
              <span className="flex items-center gap-3">
                {fileIsImage ? (
                  // eslint-disable-next-line @next/next/no-img-element -- uploaded evidence uses an approved R2 URL and needs an in-modal thumbnail.
                  <img
                    src={fileUrl}
                    alt="Evidence preview"
                    className="h-14 w-14 rounded-lg border border-[var(--border)] object-cover"
                  />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
                    <Icon icon="solar:file-text-broken" className="h-5 w-5" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-[var(--text-hi)]">
                    {fileName}
                  </span>
                  <span className="block text-xs text-emerald-600 dark:text-emerald-400">
                    Attached · click or drop to replace
                  </span>
                </span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    setFileUrl("");
                    setFileName("");
                    setFileIsImage(false);
                  }}
                  className="rounded-lg p-1 text-[var(--text-lo)] hover:bg-red-500/10 hover:text-red-500"
                  aria-label="Remove evidence attachment"
                >
                  <Icon icon="solar:close-circle-broken" className="h-4 w-4" />
                </button>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Icon
                  icon="solar:upload-minimalistic-broken"
                  className="h-4 w-4"
                />
                Drop a screenshot or PDF here, or click to upload (max 5 MB)
              </span>
            )}
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
