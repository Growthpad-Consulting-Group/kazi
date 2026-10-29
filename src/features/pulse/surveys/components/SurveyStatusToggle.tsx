"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SurveyStatus } from "@/types/database";
import { Button } from "@/components/ui/Button";

export function SurveyStatusToggle({
  surveyId,
  currentStatus,
}: {
  surveyId: string;
  currentStatus: SurveyStatus;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function setStatus(status: SurveyStatus) {
    setSaving(true);
    await fetch(`/api/pulse/surveys/${surveyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      {currentStatus === "draft" && (
        <Button
          size="sm"
          icon="solar:play-circle-broken"
          loading={saving}
          onClick={() => setStatus("active")}
        >
          Launch survey
        </Button>
      )}
      {currentStatus === "active" && (
        <Button
          size="sm"
          variant="secondary"
          icon="solar:lock-keyhole-broken"
          loading={saving}
          onClick={() => setStatus("closed")}
        >
          Close survey
        </Button>
      )}
    </div>
  );
}
