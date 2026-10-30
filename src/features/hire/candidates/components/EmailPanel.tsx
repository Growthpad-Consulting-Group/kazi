"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/Button";
import { RichEmailEditor } from "@/components/ui/RichEmailEditor";

type EmailType = "invite" | "rejection";
type Draft = {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  to: string;
};

const TYPE_LABELS: Record<EmailType, string> = {
  invite: "Interview Invite",
  rejection: "Rejection",
};

export function EmailPanel({ candidateId }: { candidateId: string }) {
  const [type, setType] = useState<EmailType>("invite");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentMessage, setSentMessage] = useState("");
  const [error, setError] = useState("");
  const [resending, setResending] = useState(false);

  async function resendConfirmation() {
    setResending(true);
    setError("");
    try {
      const res = await fetch(`/api/hire/candidates/${candidateId}/resend-confirmation`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not resend confirmation.");
      setSentMessage("Application confirmation resent successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resend confirmation.");
    } finally { setResending(false); }
  }

  async function draftEmail() {
    setDrafting(true);
    setDraft(null);
    setError("");
    setSentMessage("");
    try {
      const res = await fetch("/api/hire/candidates/draft-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId, type }),
      });
      const text = await res.text();
      let json: {
        subject?: string;
        body?: string;
        to?: string;
        error?: string;
      };
      try {
        json = JSON.parse(text) as typeof json;
      } catch {
        throw new Error(
          "Unable to draft an email right now. Please try again.",
        );
      }
      if (!res.ok) throw new Error(json.error);
      if (!json.subject || !json.body || !json.to)
        throw new Error("The AI draft was incomplete. Please try again.");
      setDraft({
        subject: json.subject,
        bodyText: json.body,
        bodyHtml: plainTextToHtml(json.body),
        to: json.to,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Draft failed");
    } finally {
      setDrafting(false);
    }
  }

  async function sendEmail() {
    if (!draft) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/hire/candidates/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSentMessage("Email sent successfully.");
      setDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 transition-shadow duration-200 hover:shadow-2xl dark:shadow-black/20 sm:p-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/10">
          <Icon
            icon="solar:letter-broken"
            className="h-3.5 w-3.5 text-brand-500"
          />
        </span>
        <div>
          <h2 className="text-base font-semibold text-[var(--text-hi)]">
            Candidate communications
          </h2>
          <p className="text-xs text-[var(--text-lo)]">
            Draft and send thoughtful updates with AI assistance.
          </p>
        </div>
      </div>

      {sentMessage && (
        <p className="rounded-xl bg-green-500/10 px-3 py-2 text-sm text-green-600">
          ✓ {sentMessage}
        </p>
      )}

      <div className="flex flex-wrap gap-1 rounded-xl bg-[var(--surface-2)] p-1">
        {(Object.keys(TYPE_LABELS) as EmailType[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              setType(t);
              setDraft(null);
              setSentMessage("");
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              type === t
                ? "bg-brand-500 text-white shadow-sm"
                : "text-[var(--text-lo)] hover:bg-[var(--surface)] hover:text-[var(--text-hi)]"
            }`}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-3">
        <p className="text-xs text-[var(--text-lo)]">The application confirmation is sent automatically. Resend it only if delivery failed or the candidate asks.</p>
        <Button size="sm" variant="secondary" loading={resending} icon="solar:refresh-broken" onClick={resendConfirmation}>Resend confirmation</Button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {!draft ? (
        <Button
          onClick={draftEmail}
          loading={drafting}
          icon="solar:magic-stick-3-broken"
          variant="secondary"
        >
          Draft with AI
        </Button>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-lo)]">
              To
            </label>
            <p className="text-sm text-[var(--text-hi)]">{draft.to}</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-lo)]">
              Subject
            </label>
            <input
              value={draft.subject}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-hi)] outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-lo)]">
              Body
            </label>
            <RichEmailEditor
              initialHtml={draft.bodyHtml}
              onChange={(bodyHtml, bodyText) =>
                setDraft({ ...draft, bodyHtml, bodyText })
              }
            />
          </div>
          <p className="text-xs italic text-[var(--text-lo)]">
            Review this email before sending — AI drafted it, you own it.
          </p>
          <div className="flex gap-2">
            <Button
              onClick={sendEmail}
              loading={sending}
              icon="solar:plain-2-broken"
            >
              Send email
            </Button>
            <Button onClick={() => setDraft(null)} variant="secondary">
              Discard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function plainTextToHtml(text: string) {
  const escapeHtml = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  return text
    .split(/\n{2,}/)
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p>${escapeHtml(paragraph).replaceAll("\n", "<br />")}</p>`,
    )
    .join("");
}
