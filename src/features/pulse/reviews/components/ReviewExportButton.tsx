"use client";

import { Button } from "@/components/ui/Button";

type ReviewExportRow = {
  name: string;
  jobTitle: string;
  reviewType: string;
  reviewer: string;
  rating: number | null;
  strengths: string;
  developmentAreas: string;
  submittedAt: string | null;
};

function escape(value: string | number | null) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function ReviewExportButton({
  title,
  rows,
}: {
  title: string;
  rows: ReviewExportRow[];
}) {
  function download() {
    const heading = [
      "Employee",
      "Job title",
      "Review type",
      "Reviewer",
      "Overall rating",
      "Strengths",
      "Development areas",
      "Submitted at",
    ];
    const csv = [
      heading,
      ...rows.map((row) => [
        row.name,
        row.jobTitle,
        row.reviewType,
        row.reviewer,
        row.rating,
        row.strengths,
        row.developmentAreas,
        row.submittedAt,
      ]),
    ]
      .map((row) => row.map(escape).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-final-reviews.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Button
      size="sm"
      variant="secondary"
      icon="solar:download-minimalistic-broken"
      onClick={download}
    >
      Export final summaries
    </Button>
  );
}
