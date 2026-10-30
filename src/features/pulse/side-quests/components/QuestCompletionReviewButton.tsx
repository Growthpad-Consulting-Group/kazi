"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function QuestCompletionReviewButton({
  questId,
  userId,
}: {
  questId: string;
  userId: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState("");
  async function review(action: "approve" | "reject") {
    setSaving(action);
    setError("");
    try {
      const response = await fetch(
        `/api/pulse/side-quests/${questId}/completions/${userId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok)
        throw new Error(data?.error ?? "Could not review this submission.");
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not review this submission.",
      );
    } finally {
      setSaving(null);
    }
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          loading={saving === "reject"}
          onClick={() => review("reject")}
        >
          Reject
        </Button>
        <Button
          size="sm"
          loading={saving === "approve"}
          onClick={() => review("approve")}
        >
          Approve
        </Button>
      </div>
      {error && <p className="text-right text-[10px] text-red-500">{error}</p>}
    </div>
  );
}
