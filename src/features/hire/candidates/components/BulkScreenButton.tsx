"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BulkScreenButton({ candidateIds }: { candidateIds: string[] }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "queuing" | "done">("idle");
  const [result, setResult] = useState<{
    queued: number;
    total: number;
  } | null>(null);

  async function enqueue() {
    setState("queuing");
    const res = await fetch("/api/hire/candidates/screen-queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateIds }),
    });
    const data = await res.json();
    setResult(data);
    setState("done");
    setTimeout(() => {
      setState("idle");
      setResult(null);
      router.refresh();
    }, 4000);
  }

  if (state === "done" && result) {
    return (
      <span className="text-xs text-green-600 font-medium">
        ✓ {result.queued} candidate{result.queued !== 1 ? "s" : ""} queued for
        screening
      </span>
    );
  }

  return (
    <button
      onClick={enqueue}
      disabled={state === "queuing" || candidateIds.length === 0}
      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
    >
      {state === "queuing"
        ? "Queuing…"
        : `Bulk screen (${candidateIds.length})`}
    </button>
  );
}
