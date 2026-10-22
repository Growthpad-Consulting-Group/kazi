"use client";
/* eslint-disable @next/next/no-img-element -- attachments are dynamic R2 images. */

import { useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/Button";

const topics = [
  ["workplace", "Workplace", "Workload, ways of working, or a concern at work"],
  ["wellbeing", "Wellbeing", "Support, safety, or your experience at work"],
  ["inclusion", "Inclusion", "Fairness, belonging, or respect"],
  ["leadership", "Leadership", "A team or leadership concern"],
  ["other", "Something else", "Anything that does not fit the options above"],
] as const;

export function VoiceOutForm() {
  const [topic, setTopic] = useState<(typeof topics)[number][0]>("workplace");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [allowsFollowUp, setAllowsFollowUp] = useState(false);
  const [sentiment, setSentiment] = useState<"negative" | "neutral" | "positive">("neutral");
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (attachments.length >= 3) return;
    setUploading(true); setError("");
    try {
      const form = new FormData(); form.append("file", file);
      const response = await fetch("/api/pulse/voice-out/upload", { method: "POST", body: form });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "We could not upload that image.");
      setAttachments((current) => [...current, data.url]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "We could not upload that image."); }
    finally { setUploading(false); }
  }

  async function submit() {
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/pulse/voice-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, message, attachments, allows_follow_up: allowsFollowUp, sentiment }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "We could not submit your feedback.");
      setMessage(""); setAttachments([]); setSent(true); setAccessCode(data?.accessCode ?? null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "We could not submit your feedback."); }
    finally { setSaving(false); }
  }

  if (sent) return <section className="rounded-2xl border border-emerald-500/20 bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6">
    <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600"><Icon icon="solar:check-circle-broken" className="h-5 w-5" /></span><div><h2 className="text-base font-semibold text-[var(--text-hi)]">Submitted anonymously</h2><p className="mt-1 text-xs leading-relaxed text-[var(--text-lo)]">The HR team can now review this theme.</p></div></div>
    {accessCode && <div className="mt-5 rounded-xl border border-blue-500/15 bg-blue-500/[0.05] p-4"><p className="text-xs font-semibold text-[var(--text-hi)]">Your private follow-up code</p><p className="mt-1 text-[11px] leading-relaxed text-[var(--text-lo)]">Save this code somewhere private. It is the only way to read or send anonymous replies, and Kazi cannot recover it.</p><code className="mt-3 block break-all rounded-lg bg-[var(--surface)] px-3 py-2 font-mono text-xs font-semibold text-blue-600">{accessCode}</code><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="secondary" icon="solar:copy-broken" onClick={() => void navigator.clipboard?.writeText(accessCode)}>Copy code</Button><Link href="/pulse/voice-out/follow-up" className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-brand-600"><Icon icon="solar:chat-round-dots-broken" className="h-3.5 w-3.5" />Open follow-up</Link></div></div>}
    <div className="mt-5"><Button variant="secondary" onClick={() => { setSent(false); setAccessCode(null); }}>Send another report</Button></div>
  </section>;

  return <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6">
    <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500"><Icon icon="solar:incognito-broken" className="h-5 w-5" /></span><div><h2 className="text-base font-semibold text-[var(--text-hi)]">Share what needs attention</h2><p className="mt-1 text-xs leading-relaxed text-[var(--text-lo)]">Your name, account and staff record are not saved with this report. Please avoid identifying details if anonymity matters to you.</p></div></div>
    <fieldset className="mt-6"><legend className="text-xs font-semibold text-[var(--text-hi)]">What is this about?</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{topics.map(([value, label, description]) => <button key={value} type="button" onClick={() => setTopic(value)} className={`rounded-xl border p-3 text-left transition-colors ${topic === value ? "border-brand-500/30 bg-brand-500/[0.06]" : "border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface)]"}`}><span className="block text-xs font-semibold text-[var(--text-hi)]">{label}</span><span className="mt-1 block text-[11px] leading-relaxed text-[var(--text-lo)]">{description}</span></button>)}</div></fieldset>
    <div className="mt-5"><label htmlFor="voice-out-message" className="text-xs font-semibold text-[var(--text-hi)]">Your message</label><textarea id="voice-out-message" rows={7} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Describe what happened, how it is affecting staff, and what would help…" className="mt-2 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm leading-relaxed text-[var(--text-hi)] outline-none placeholder:text-[var(--text-lo)] focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10" /><p className="mt-1.5 text-right text-[10px] text-[var(--text-lo)]">{message.length}/2,000</p></div>
    <div className="mt-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-[var(--text-hi)]">Optional screenshots</p><p className="mt-0.5 text-[11px] text-[var(--text-lo)]">Up to three images, 5 MB each.</p></div><input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = ""; }} /><Button size="sm" variant="secondary" icon="solar:upload-minimalistic-broken" loading={uploading} disabled={uploading || attachments.length >= 3} onClick={() => inputRef.current?.click()}>{attachments.length ? `Add image (${attachments.length}/3)` : "Add image"}</Button></div>{attachments.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{attachments.map((url) => <div key={url} className="relative h-16 w-16 overflow-hidden rounded-lg border border-[var(--border)]"><img src={url} alt="Attached to anonymous report" className="h-full w-full object-cover" /><button type="button" aria-label="Remove attachment" onClick={() => setAttachments((current) => current.filter((item) => item !== url))} className="absolute right-1 top-1 rounded bg-black/60 p-0.5 text-white"><Icon icon="solar:close-circle-broken" className="h-3 w-3" /></button></div>)}</div>}</div>
    <fieldset className="mt-5"><legend className="text-xs font-semibold text-[var(--text-hi)]">How does this feel? <span className="font-normal text-[var(--text-lo)]">Optional</span></legend><div className="mt-2 flex flex-wrap gap-2">{(["negative", "neutral", "positive"] as const).map((value) => <button key={value} type="button" onClick={() => setSentiment(value)} className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${sentiment === value ? value === "negative" ? "bg-red-500/10 text-red-600 ring-1 ring-red-500/20" : value === "positive" ? "bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20" : "bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/20" : "bg-[var(--surface-2)] text-[var(--text-lo)]"}`}>{value === "negative" ? "Concerning" : value === "positive" ? "Positive" : "Neutral"}</button>)}</div></fieldset>
    <div className="mt-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-[var(--text-hi)]">Optional screenshots</p><p className="mt-0.5 text-[11px] text-[var(--text-lo)]">Up to three images, 5 MB each.</p></div><input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = ""; }} /><Button size="sm" variant="secondary" icon="solar:upload-minimalistic-broken" loading={uploading} disabled={uploading || attachments.length >= 3} onClick={() => inputRef.current?.click()}>{attachments.length ? `Add image (${attachments.length}/3)` : "Add image"}</Button></div>{attachments.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{attachments.map((url) => <div key={url} className="relative h-16 w-16 overflow-hidden rounded-lg border border-[var(--border)]"><img src={url} alt="Attached to anonymous report" className="h-full w-full object-cover" /><button type="button" aria-label="Remove attachment" onClick={() => setAttachments((current) => current.filter((item) => item !== url))} className="absolute right-1 top-1 rounded bg-black/60 p-0.5 text-white"><Icon icon="solar:close-circle-broken" className="h-3 w-3" /></button></div>)}</div>}</div>
    <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-blue-500/15 bg-blue-500/[0.04] p-3"><input type="checkbox" checked={allowsFollowUp} onChange={(event) => setAllowsFollowUp(event.target.checked)} className="mt-0.5 rounded border-[var(--border)] text-brand-500 focus:ring-brand-500" /><span><span className="block text-xs font-semibold text-[var(--text-hi)]">Allow anonymous follow-up</span><span className="mt-1 block text-[11px] leading-relaxed text-[var(--text-lo)]">Kazi will give you a private access code. HR can reply through that code without seeing who you are.</span></span></label>
    {error && <p role="alert" className="mt-3 text-xs font-medium text-red-500">{error}</p>}
    <div className="mt-4 flex justify-end"><Button icon="solar:plain-2-broken" loading={saving} disabled={saving || uploading || message.trim().length < 20 || message.length > 2000} onClick={submit}>Send anonymously</Button></div>
  </section>;
}
