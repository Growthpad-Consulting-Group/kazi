"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function QuestCompletionButton({ questId, complete }: { questId: string; complete: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  if (complete) return <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">Completed</span>;
  async function markComplete() { setSaving(true); setError(""); try { const response = await fetch(`/api/pulse/side-quests/${questId}/progress`, { method: "POST" }); const data = await response.json().catch(() => null) as { error?: string } | null; if (!response.ok) throw new Error(data?.error ?? "Could not record completion."); router.refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not record completion."); } finally { setSaving(false); } }
  return <div className="flex flex-col items-end gap-1"><Button size="sm" icon="solar:check-circle-broken" loading={saving} onClick={markComplete}>{saving ? "Saving" : "Mark complete"}</Button>{error && <p className="max-w-48 text-right text-[10px] text-red-500">{error}</p>}</div>;
}
