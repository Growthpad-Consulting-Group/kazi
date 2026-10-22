"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/Button";

const KUDOS_EMOJIS = ["🔥", "💪", "⭐", "🙌", "💡", "🚀", "❤️", "👏"];

interface Props { fromUserId: string; users: { id: string; name: string }[]; }

export function SendFeedbackForm({ fromUserId, users }: Props) {
  const router = useRouter();
  const [toUserId, setToUserId] = useState(users[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [emoji, setEmoji] = useState("⭐");
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!message.trim() || !toUserId) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/pulse/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from_user_id: fromUserId, to_user_id: toUserId, message, visibility, emoji: visibility === "public" ? emoji : null }) });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Could not send feedback.");
      setSent(true); setMessage(""); router.refresh();
      window.setTimeout(() => setSent(false), 3000);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not send feedback."); } finally { setSaving(false); }
  }

  return <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20"><div className="flex items-start gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500"><Icon icon="solar:heart-broken" className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold text-[var(--text-hi)]">Share feedback</h2><p className="mt-0.5 text-xs text-[var(--text-lo)]">Make it specific, timely, and useful.</p></div></div>
    <div className="mt-5 grid grid-cols-2 gap-2">{(["public", "private"] as const).map((value) => <button key={value} type="button" onClick={() => setVisibility(value)} className={`rounded-xl border p-3 text-left transition-colors ${visibility === value ? value === "public" ? "border-brand-500/30 bg-brand-500/[0.06]" : "border-blue-500/25 bg-blue-500/[0.06]" : "border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface)]"}`}><Icon icon={value === "public" ? "solar:star-fall-broken" : "solar:lock-keyhole-minimalistic-broken"} className={`h-4 w-4 ${visibility === value ? value === "public" ? "text-brand-500" : "text-blue-600" : "text-[var(--text-lo)]"}`} /><span className="mt-2 block text-xs font-semibold text-[var(--text-hi)]">{value === "public" ? "Shout-out" : "Private note"}</span><span className="mt-0.5 block text-[10px] leading-relaxed text-[var(--text-lo)]">{value === "public" ? "Celebrate work with the team." : "Share feedback just with them."}</span></button>)}</div>
    <div className="mt-4"><label className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">To</label><select value={toUserId} onChange={(event) => setToUserId(event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10">{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></div>
    {visibility === "public" && <div className="mt-4"><p className="mb-1.5 text-xs font-semibold text-[var(--text-hi)]">Pick a moment</p><div className="flex flex-wrap gap-1.5">{KUDOS_EMOJIS.map((item) => <button key={item} type="button" onClick={() => setEmoji(item)} aria-label={`Use ${item}`} className={`flex h-8 w-8 items-center justify-center rounded-lg text-base transition-colors ${emoji === item ? "bg-brand-500/15 ring-1 ring-brand-500/35" : "bg-[var(--surface-2)] hover:bg-brand-500/10"}`}>{item}</button>)}</div></div>}
    <div className="mt-4"><label className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">Your message</label><textarea rows={4} value={message} onChange={(event) => setMessage(event.target.value)} placeholder={visibility === "public" ? "What did they do that deserves recognition?" : "Share constructive, specific feedback…"} className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm leading-relaxed text-[var(--text-hi)] outline-none placeholder:text-[var(--text-lo)] focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10" /></div>
    {error && <p className="mt-3 text-xs font-medium text-red-500">{error}</p>}{sent && <p className="mt-3 text-xs font-medium text-emerald-600">Feedback sent.</p>}<div className="mt-4 flex justify-end"><Button icon={visibility === "public" ? "solar:star-fall-broken" : "solar:letter-broken"} loading={saving} disabled={saving || !message.trim() || !toUserId} onClick={submit}>{saving ? "Sending" : visibility === "public" ? "Share shout-out" : "Send privately"}</Button></div>
  </section>;
}
