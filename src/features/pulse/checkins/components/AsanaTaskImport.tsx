"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/Button";

type Task = { id: string; name: string; completedAt: string; project: string | null; url: string | null };

export function AsanaTaskImport({ weekStart, onImport }: { weekStart: string; onImport: (bullets: string) => void }) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsConnection, setNeedsConnection] = useState(false);

  async function loadTasks() {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/pulse/checkins/asana-tasks?weekStart=${encodeURIComponent(weekStart)}`);
      const data = await response.json().catch(() => null) as { connected?: boolean; tasks?: Task[]; error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to load Asana tasks.");
      if (!data?.connected) { setNeedsConnection(true); return; }
      const importedTasks = data.tasks ?? [];
      setTasks(importedTasks);
      setSelected(new Set(importedTasks.map((task) => task.id)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load Asana tasks.");
    } finally { setLoading(false); }
  }

  function importSelected() {
    const bullets = (tasks ?? []).filter((task) => selected.has(task.id)).map((task) => `• ${task.name}${task.project ? ` — ${task.project}` : ""}`).join("\n");
    if (bullets) onImport(bullets);
    setTasks(null);
  }

  return (
    <div className="mb-2">
      {!tasks && !needsConnection && <Button variant="secondary" size="sm" icon="solar:import-broken" loading={loading} onClick={loadTasks}>Import completed Asana tasks</Button>}
      {needsConnection && <div className="flex flex-wrap items-center gap-2 rounded-xl border border-sky-500/15 bg-sky-500/5 px-3 py-2"><Icon icon="solar:link-broken" className="h-4 w-4 text-sky-600" /><span className="text-xs text-[var(--text-lo)]">Connect your Asana account to import your completed work.</span><Button size="sm" variant="secondary" onClick={() => router.push("/api/integrations/asana/connect?returnTo=/pulse/checkins")}>Connect Asana</Button></div>}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {tasks && <div className="mt-2 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)]"><div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-3 py-2"><div><p className="text-xs font-semibold text-[var(--text-hi)]">Completed in Asana</p><p className="text-[11px] text-[var(--text-lo)]">Select work to add as editable wins.</p></div><button type="button" onClick={() => setTasks(null)} className="text-xs font-medium text-[var(--text-lo)] hover:text-[var(--text-hi)]">Close</button></div>{tasks.length ? <div className="max-h-48 overflow-y-auto p-1">{tasks.map((task) => <label key={task.id} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 hover:bg-[var(--surface)]"><input type="checkbox" checked={selected.has(task.id)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(task.id)) next.delete(task.id); else next.add(task.id); return next; })} className="mt-0.5 accent-[#f05d23]" /><span className="min-w-0 flex-1"><span className="block text-xs font-medium text-[var(--text-hi)]">{task.name}</span>{task.project && <span className="block truncate text-[11px] text-[var(--text-lo)]">{task.project}</span>}</span></label>)}</div> : <p className="px-3 py-5 text-center text-xs text-[var(--text-lo)]">No assigned tasks were completed in this week.</p>}{tasks.length > 0 && <div className="flex justify-end border-t border-[var(--border)] p-2"><Button size="sm" disabled={selected.size === 0} onClick={importSelected}>Add {selected.size} to wins</Button></div>}</div>}
    </div>
  );
}
