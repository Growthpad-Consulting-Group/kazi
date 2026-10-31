"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";

export function PerformanceAuditExportButton() {
  const [loading, setLoading] = useState(false);
  async function download() {
    setLoading(true);
    try {
      const response = await fetch("/api/pulse/performance/audit-export");
      if (!response.ok) throw new Error("Could not prepare the audit export.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "performance-audit-export.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not prepare the audit export.",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <Button
      size="sm"
      variant="secondary"
      icon="solar:document-text-broken"
      loading={loading}
      onClick={download}
    >
      Audit export
    </Button>
  );
}
