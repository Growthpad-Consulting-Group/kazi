"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";

type EmailType = "acknowledgement" | "invite" | "rejection" | "acceptance";
type Recipient = { id: string; full_name: string };
type Draft = {
  candidateId: string;
  name: string;
  to: string;
  subject: string;
  body: string;
  include: boolean;
  status: "idle" | "sent" | "failed";
  error?: string;
};

const TYPE_LABELS: Record<EmailType, string> = {
  acceptance: "Acceptance / next steps",
  rejection: "Rejection",
  invite: "Interview invite",
  acknowledgement: "Acknowledgement",
};

export const MAX_BULK_EMAIL_RECIPIENTS = 25;

export function BulkEmailModal({
  recipients,
  open,
  onClose,
}: {
  recipients: Recipient[];
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [type, setType] = useState<EmailType>("acceptance");
  const [phase, setPhase] = useState<"choose" | "drafting" | "review" | "sending" | "done">("choose");
  const [progress, setProgress] = useState(0);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const tooMany = recipients.length > MAX_BULK_EMAIL_RECIPIENTS;

  const reset = () => {
    setPhase("choose");
    setProgress(0);
    setDrafts([]);
  };

  const close = () => {
    if (phase === "drafting" || phase === "sending") return;
    reset();
    onClose();
  };

  const generateDrafts = async () => {
    setPhase("drafting");
    setProgress(0);
    const result: Draft[] = [];
    for (const recipient of recipients) {
      try {
        const res = await fetch("/api/hire/candidates/draft-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidateId: recipient.id, type }),
        });
        const json = await res.json().catch(() => null) as { subject?: string; body?: string; to?: string; error?: string } | null;
        if (!res.ok || !json?.subject || !json.body || !json.to) {
          result.push({ candidateId: recipient.id, name: recipient.full_name, to: "", subject: "", body: "", include: false, status: "failed", error: json?.error ?? "Draft failed" });
        } else {
          result.push({ candidateId: recipient.id, name: recipient.full_name, to: json.to, subject: json.subject, body: json.body, include: true, status: "idle" });
        }
      } catch {
        result.push({ candidateId: recipient.id, name: recipient.full_name, to: "", subject: "", body: "", include: false, status: "failed", error: "Draft failed" });
      }
      setProgress(result.length);
    }
    setDrafts(result);
    setPhase("review");
  };

  const updateDraft = (candidateId: string, patch: Partial<Draft>) => {
    setDrafts((prev) => prev.map((d) => (d.candidateId === candidateId ? { ...d, ...patch } : d)));
  };

  const sendAll = async () => {
    const toSend = drafts.filter((d) => d.include && d.to);
    if (!toSend.length) {
      toast.error("Select at least one email to send");
      return;
    }
    setPhase("sending");
    setProgress(0);
    let sentCount = 0;
    for (const draft of toSend) {
      const bodyHtml = plainTextToHtml(draft.body);
      try {
        const res = await fetch("/api/hire/candidates/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: draft.to, subject: draft.subject, bodyText: draft.body, bodyHtml }),
        });
        const json = await res.json().catch(() => null) as { error?: string } | null;
        if (!res.ok) throw new Error(json?.error ?? "Send failed");
        sentCount += 1;
        updateDraft(draft.candidateId, { status: "sent", error: undefined });
      } catch (e) {
        updateDraft(draft.candidateId, { status: "failed", error: e instanceof Error ? e.message : "Send failed" });
      }
      setProgress((p) => p + 1);
    }
    const failed = toSend.length - sentCount;
    if (failed === 0) toast.success(`Sent ${sentCount} email${sentCount === 1 ? "" : "s"}`);
    else toast.error(`Sent ${sentCount}, ${failed} failed`);
    setPhase("done");
    router.refresh();
  };

  const includedCount = drafts.filter((d) => d.include && d.to).length;

  return (
    <SimpleModal open={open} onClose={close} title="Send email to candidates" icon="solar:letter-broken" maxWidth="max-w-2xl">
      {phase === "choose" && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-lo)]">
            {recipients.length} candidate{recipients.length === 1 ? "" : "s"} selected. AI will draft a personal email for each, and you review every one before anything is sent.
          </p>
          {tooMany && (
            <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-600">
              Bulk email is limited to {MAX_BULK_EMAIL_RECIPIENTS} candidates at a time. Deselect some rows and try again.
            </p>
          )}
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--text-lo)]">Email type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as EmailType)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-hi)] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
            >
              {(Object.keys(TYPE_LABELS) as EmailType[]).map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button icon="solar:magic-stick-3-broken" disabled={tooMany || recipients.length === 0} onClick={generateDrafts}>
              Draft emails
            </Button>
          </div>
        </div>
      )}

      {phase === "drafting" && (
        <div className="space-y-3 py-6 text-center">
          <p className="text-sm font-medium text-[var(--text-hi)]">Drafting {progress + 1 > recipients.length ? recipients.length : progress + 1} of {recipients.length}…</p>
          <div className="mx-auto h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-[var(--surface-2)]">
            <div className="h-full rounded-full bg-brand-500 transition-all duration-300" style={{ width: `${(progress / recipients.length) * 100}%` }} />
          </div>
        </div>
      )}

      {phase === "review" && (
        <div className="space-y-4">
          <p className="text-xs italic text-[var(--text-lo)]">Review each email before sending. AI drafted them, you own them.</p>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {drafts.map((draft) => (
              <div key={draft.candidateId} className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-hi)]">
                    <input
                      type="checkbox"
                      checked={draft.include}
                      disabled={!draft.to}
                      onChange={(e) => updateDraft(draft.candidateId, { include: e.target.checked })}
                      className="h-4 w-4 accent-brand-500"
                    />
                    {draft.name}
                  </label>
                  {draft.to ? <span className="truncate text-xs text-[var(--text-lo)]">{draft.to}</span> : <span className="text-xs text-red-500">{draft.error}</span>}
                </div>
                {draft.to && (
                  <>
                    <input
                      value={draft.subject}
                      onChange={(e) => updateDraft(draft.candidateId, { subject: e.target.value })}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-hi)] outline-none focus:ring-2 focus:ring-brand-500/30"
                    />
                    <textarea
                      value={draft.body}
                      onChange={(e) => updateDraft(draft.candidateId, { body: e.target.value })}
                      rows={5}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-hi)] outline-none focus:ring-2 focus:ring-brand-500/30"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-4">
            <p className="text-xs text-[var(--text-lo)]">{includedCount} will be sent</p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={reset}>Back</Button>
              <Button icon="solar:plain-2-broken" disabled={includedCount === 0} onClick={sendAll}>Send {includedCount}</Button>
            </div>
          </div>
        </div>
      )}

      {phase === "sending" && (
        <div className="space-y-3 py-6 text-center">
          <p className="text-sm font-medium text-[var(--text-hi)]">Sending {Math.min(progress + 1, includedCount)} of {includedCount}…</p>
          <div className="mx-auto h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-[var(--surface-2)]">
            <div className="h-full rounded-full bg-brand-500 transition-all duration-300" style={{ width: `${(progress / includedCount) * 100}%` }} />
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="space-y-4">
          <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {drafts.filter((d) => d.include || d.status === "failed").map((draft) => (
              <div key={draft.candidateId} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-2)] px-3 py-2.5">
                <span className="text-sm text-[var(--text-hi)]">{draft.name}</span>
                {draft.status === "sent"
                  ? <span className="text-xs font-medium text-green-600">Sent</span>
                  : <span className="text-xs text-red-500">{draft.error ?? "Not sent"}</span>}
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={close}>Done</Button>
          </div>
        </div>
      )}
    </SimpleModal>
  );
}

function plainTextToHtml(text: string) {
  const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  return text.split(/\n{2,}/).filter(Boolean).map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br />")}</p>`).join("");
}
