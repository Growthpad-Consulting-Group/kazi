"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SurveyStatus } from "@/types/database";

export function SurveyStatusToggle({ surveyId, currentStatus }: { surveyId: string; currentStatus: SurveyStatus }) {
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
        <button onClick={() => setStatus("active")} disabled={saving}
          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
          Launch
        </button>
      )}
      {currentStatus === "active" && (
        <button onClick={() => setStatus("closed")} disabled={saving}
          className="rounded-lg bg-slate-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition-colors">
          Close
        </button>
      )}
    </div>
  );
}
