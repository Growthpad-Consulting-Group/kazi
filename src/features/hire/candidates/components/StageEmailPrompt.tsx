"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";
import type { CandidateStage } from "../types";

type EmailType = "invite" | "acceptance" | "rejection";
type Draft = { to: string; subject: string; body: string; candidateName: string };

const STAGE_EMAIL: Partial<Record<CandidateStage, { type: EmailType; title: string; hint: string }>> = {
  interview: { type: "invite", title: "Invite to interview", hint: "Ask the candidate to confirm their availability." },
  offer: { type: "acceptance", title: "Share next steps", hint: "Congratulate them and explain what happens next." },
  rejected: { type: "rejection", title: "Let the candidate know", hint: "A respectful decline. Review it before it goes out." },
};

const escapeHtml = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

function plainTextToHtml(text: string) {
  return text
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br />")}</p>`)
    .join("");
}

function StageEmailDialog({ candidateId, type, title, hint, onClose }: { candidateId: string; type: EmailType; title: string; hint: string; onClose: () => void }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/hire/candidates/draft-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId, type }),
    })
      .then((res) => res.json().then((json) => ({ ok: res.ok, json })))
      .then(({ ok, json }) => {
        if (cancelled) return;
        if (!ok || !json.subject || !json.body || !json.to) throw new Error(json.error ?? "The draft could not be created.");
        setDraft({ to: json.to, subject: json.subject, body: json.body, candidateName: json.candidateName });
      })
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [candidateId, type]);

  async function send() {
    if (!draft) return;
    setSending(true);
    try {
      const res = await fetch("/api/hire/candidates/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: draft.to, subject: draft.subject, bodyText: draft.body, bodyHtml: plainTextToHtml(draft.body) }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? "The email could not be sent.");
      toast.success(`Email sent to ${draft.candidateName}`);
      onClose();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The email could not be sent.");
    } finally {
      setSending(false);
    }
  }

  return (
    <SimpleModal open onClose={() => !sending && onClose()} title={title} icon="solar:letter-broken" maxWidth="max-w-lg">
      <div className="space-y-4">
        <p className="text-xs text-[var(--text-lo)]">{hint} Drafted by AI. You review it before anything is sent.</p>
        {error && <p className="text-xs font-medium text-red-500">{error}</p>}
        {!draft && !error && <p className="py-6 text-center text-sm text-[var(--text-lo)]">Drafting the email…</p>}
        {draft && (
          <>
            <p className="text-xs text-[var(--text-lo)]">To <span className="font-medium text-[var(--text-hi)]">{draft.to}</span></p>
            <input
              value={draft.subject}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500/60"
            />
            <textarea
              rows={10}
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm leading-relaxed text-[var(--text-hi)] outline-none focus:border-brand-500/60"
            />
          </>
        )}
        <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button variant="secondary" disabled={sending} onClick={onClose}>Skip</Button>
          <Button loading={sending} disabled={!draft || !draft.subject.trim() || !draft.body.trim()} onClick={send}>Send email</Button>
        </div>
      </div>
    </SimpleModal>
  );
}

/** Call after a stage change succeeds. Renders the review prompt for stages that need an email. */
export function useStageEmailPrompt() {
  const [pending, setPending] = useState<{ candidateId: string; stage: CandidateStage } | null>(null);
  const config = pending ? STAGE_EMAIL[pending.stage] : undefined;

  const dialog = pending && config ? (
    <StageEmailDialog candidateId={pending.candidateId} type={config.type} title={config.title} hint={config.hint} onClose={() => setPending(null)} />
  ) : null;

  return {
    requestStageEmail: (candidateId: string, stage: CandidateStage) => {
      if (STAGE_EMAIL[stage]) setPending({ candidateId, stage });
    },
    stageEmailDialog: dialog,
  };
}
