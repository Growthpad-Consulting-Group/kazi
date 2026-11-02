"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";
import toast from "react-hot-toast";
import ExportModal from "@/components/ui/export/ExportModal";

type ExportField = { key: string; label: string };
type ExportPayload = {
  title: string;
  rows: Record<string, string>[];
  fields: ExportField[];
};

export function SurveyResultsExportButton({ surveyId }: { surveyId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<ExportPayload>({
    title: "Survey results",
    rows: [],
    fields: [],
  });

  async function prepareExport() {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/pulse/surveys/${surveyId}/export?format=json`,
      );
      const data = (await response
        .json()
        .catch(() => ({}))) as Partial<ExportPayload> & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error ?? "Could not prepare survey results.");
      setPayload({
        title: data.title ?? "Survey results",
        rows: data.rows ?? [],
        fields: data.fields ?? [],
      });
      setOpen(true);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not prepare survey results.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={prepareExport}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold text-[var(--text-hi)] transition-colors hover:bg-[var(--border)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Icon
          icon={loading ? "solar:refresh-broken" : "solar:export-broken"}
          className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
        />
        {loading ? "Preparing…" : "Export results"}
      </button>
      <ExportModal
        isOpen={open}
        onClose={() => setOpen(false)}
        users={payload.rows}
        mode="light"
        type="survey_results"
        title={`${payload.title} results`}
        getFieldsOrder={() =>
          payload.fields.map((field) => ({
            ...field,
            icon: "solar:document-text-broken",
          }))
        }
      />
    </>
  );
}
