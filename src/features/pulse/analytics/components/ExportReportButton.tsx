"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import ExportModal from "@/components/ui/export/ExportModal";

type CultureReport = {
  campaigns?: {
    name: string;
    status: string;
    starts_at: string | null;
    ends_at: string | null;
  }[];
  recognition_summary?: {
    total_last_30d: number;
    top_values: { value: string; count: number }[];
    top_givers: { name: string; count: number }[];
  };
  voice_out_themes?: Record<string, unknown>[];
  survey_participation?: {
    title: string;
    status: string;
    response_count: number;
  }[];
  engagement_trend?: { week: string; recognition_count: number }[];
};

type ExportRow = {
  section: string;
  label: string;
  value: string | number;
  detail?: string;
};

function toExportRows(report: CultureReport): ExportRow[] {
  const rows: ExportRow[] = [
    {
      section: "Recognition summary",
      label: "Recognitions sent",
      value: report.recognition_summary?.total_last_30d ?? 0,
      detail: "Last 30 days",
    },
  ];
  for (const value of report.recognition_summary?.top_values ?? [])
    rows.push({
      section: "Recognition values",
      label: value.value,
      value: value.count,
      detail: "Recognitions",
    });
  for (const giver of report.recognition_summary?.top_givers ?? [])
    rows.push({
      section: "Top givers",
      label: giver.name,
      value: giver.count,
      detail: "Recognitions sent",
    });
  for (const campaign of report.campaigns ?? [])
    rows.push({
      section: "Campaigns",
      label: campaign.name,
      value: campaign.status,
      detail:
        [campaign.starts_at, campaign.ends_at].filter(Boolean).join(" – ") ||
        undefined,
    });
  for (const survey of report.survey_participation ?? [])
    rows.push({
      section: "Survey participation",
      label: survey.title,
      value: survey.response_count,
      detail: survey.status,
    });
  for (const trend of report.engagement_trend ?? [])
    rows.push({
      section: "Recognition trend",
      label: trend.week,
      value: trend.recognition_count,
      detail: "Recognitions",
    });
  for (const theme of report.voice_out_themes ?? []) {
    const { topic, ...statuses } = theme as {
      topic?: string;
      [key: string]: unknown;
    };
    rows.push({
      section: "Voice Out themes",
      label: topic ?? "Untitled theme",
      value: Object.values(statuses).reduce<number>(
        (total, count) => total + (typeof count === "number" ? count : 0),
        0,
      ),
      detail: Object.entries(statuses)
        .map(([status, count]) => `${status}: ${count}`)
        .join(", "),
    });
  }
  return rows;
}

export default function ExportReportButton() {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ExportRow[]>([]);

  async function openExportModal() {
    setLoading(true);
    try {
      const response = await fetch("/api/pulse/reports/culture-export");
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? "Could not prepare the report",
        );
      }
      setRows(toExportRows((await response.json()) as CultureReport));
      setOpen(true);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not prepare the report",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openExportModal}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Icon
          icon={loading ? "solar:refresh-broken" : "solar:export-broken"}
          className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
        />
        {loading ? "Preparing…" : "Export report"}
      </button>

      <ExportModal
        isOpen={open}
        onClose={() => setOpen(false)}
        users={rows}
        mode="light"
        type="recognition_analytics"
        title="Recognition analytics report"
      />
    </>
  );
}
