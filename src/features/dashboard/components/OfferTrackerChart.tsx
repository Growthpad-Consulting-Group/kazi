export default function OfferTrackerChart({ pending, accepted, declined }: { pending: number; accepted: number; declined: number }) {
  const total = pending + accepted + declined;

  if (!total) return <div className="flex h-32 items-center justify-center text-sm text-[var(--text-lo)]">No offer decisions yet.</div>;

  const items = [{ label: "Pending offer", value: pending, color: "bg-amber-400" }, { label: "Hired", value: accepted, color: "bg-green-400" }, { label: "Rejected", value: declined, color: "bg-red-400" }];
  return <div><div className="mb-5 flex h-4 overflow-hidden rounded-full bg-[var(--surface-2)]">{items.map((item) => item.value ? <div key={item.label} className={`${item.color} transition-all`} style={{ width: `${(item.value / total) * 100}%` }} /> : null)}</div><div className="space-y-3">{items.map((item) => <div key={item.label} className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-xs text-[var(--text-lo)]"><i className={`h-2.5 w-2.5 rounded-full ${item.color}`} />{item.label}</span><span className="font-mono text-sm font-bold text-[var(--text-hi)]">{item.value} <span className="text-[10px] font-medium text-[var(--text-lo)]">({Math.round((item.value / total) * 100)}%)</span></span></div>)}</div><p className="mt-4 text-[10px] text-[var(--text-lo)]">Distribution across pending offers and completed candidate outcomes</p></div>;
}
