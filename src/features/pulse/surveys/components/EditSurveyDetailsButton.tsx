"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";
export function EditSurveyDetailsButton({
  surveyId,
  initialTitle,
  initialDescription,
}: {
  surveyId: string;
  initialTitle: string;
  initialDescription: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      const response = await fetch(`/api/pulse/surveys/${surveyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success("Draft updated");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update draft.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        icon="solar:pen-new-square-broken"
        onClick={() => setOpen(true)}
      >
        Edit draft
      </Button>
      <SimpleModal
        open={open}
        onClose={() => setOpen(false)}
        title="Edit survey draft"
        icon="solar:pen-new-square-broken"
        maxWidth="max-w-md"
      >
        <div className="space-y-3">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={save}>
              Save changes
            </Button>
          </div>
        </div>
      </SimpleModal>
    </>
  );
}
