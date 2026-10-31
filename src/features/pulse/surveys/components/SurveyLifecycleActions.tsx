"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";

export function SurveyLifecycleActions({
  surveyId,
  status,
}: {
  surveyId: string;
  status: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  async function duplicate() {
    const response = await fetch(`/api/pulse/surveys/${surveyId}`, {
      method: "POST",
    });
    const data = await response.json();
    if (!response.ok)
      return toast.error(data.error ?? "Could not duplicate survey.");
    toast.success("Draft copy created");
    router.push(`/pulse/surveys/${data.id}`);
  }
  async function remove() {
    setDeleting(true);
    try {
      const response = await fetch(`/api/pulse/surveys/${surveyId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success("Draft deleted");
      router.push("/pulse/surveys");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete survey.",
      );
    } finally {
      setDeleting(false);
    }
  }
  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        icon="solar:copy-broken"
        onClick={duplicate}
      >
        Duplicate
      </Button>
      {status === "draft" && (
        <Button
          size="sm"
          variant="danger"
          icon="solar:trash-bin-minimalistic-broken"
          onClick={() => setConfirming(true)}
        >
          Delete draft
        </Button>
      )}
      <SimpleModal
        open={confirming}
        onClose={() => !deleting && setConfirming(false)}
        title="Delete draft survey?"
        icon="solar:trash-bin-minimalistic-broken"
        maxWidth="max-w-md"
      >
        <p className="text-sm text-[var(--text-lo)]">
          This permanently deletes the unused draft and its audience setup.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button variant="danger" loading={deleting} onClick={remove}>
            Delete draft
          </Button>
        </div>
      </SimpleModal>
    </>
  );
}
