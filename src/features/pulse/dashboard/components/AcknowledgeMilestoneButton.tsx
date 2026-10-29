"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";

export function AcknowledgeMilestoneButton({
  milestoneId,
}: {
  milestoneId: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function acknowledge() {
    setSaving(true);
    try {
      const response = await fetch(
        `/api/pulse/milestones/${milestoneId}/acknowledge`,
        { method: "POST" },
      );
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok)
        throw new Error(body?.error ?? "Could not acknowledge this milestone");
      toast.success("Milestone acknowledged.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not acknowledge this milestone",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="secondary"
      loading={saving}
      onClick={acknowledge}
    >
      Acknowledge
    </Button>
  );
}
