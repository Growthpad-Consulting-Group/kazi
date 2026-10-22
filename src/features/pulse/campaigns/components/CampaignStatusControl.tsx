"use client";
import { useState } from "react";

export function CampaignStatusControl({ campaignId, status }: { campaignId: string; status: string }) {
  const [value, setValue] = useState(status); const [saving, setSaving] = useState(false);
  async function change(next: string) { setValue(next); setSaving(true); try { const response = await fetch(`/api/pulse/campaigns/${campaignId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) }); if (!response.ok) setValue(status); } finally { setSaving(false); } }
  return <select aria-label="Campaign status" value={value} disabled={saving} onChange={(event) => void change(event.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[10px] font-semibold text-[var(--text-hi)] outline-none disabled:opacity-50"><option value="draft">Draft</option><option value="upcoming">Upcoming</option><option value="live">Live</option><option value="paused">Paused</option><option value="completed">Completed</option><option value="archived">Archived</option></select>;
}
