"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  candidateId: string;
  hasCV: boolean;
  compact?: boolean;
}

export function ScreenButton({ candidateId, hasCV, compact = false }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function screen() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/hire/candidates/screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Screening failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-500">{error}</span>}
      <button
        onClick={screen}
        disabled={loading || !hasCV}
        title={!hasCV ? "Upload a CV first" : "Run AI screening"}
        className={`${compact ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs"} rounded-lg bg-brand-500 font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-40`}
      >
        {loading ? "Screening…" : "Screen with AI"}
      </button>
    </div>
  );
}
