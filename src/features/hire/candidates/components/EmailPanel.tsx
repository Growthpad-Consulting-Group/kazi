"use client";

import { useState } from "react";

type EmailType = "acknowledgement" | "invite" | "rejection";

const TYPE_LABELS: Record<EmailType, string> = {
  acknowledgement: "Acknowledgement",
  invite: "Interview Invite",
  rejection: "Rejection",
};

export function EmailPanel({ candidateId }: { candidateId: string }) {
  const [type, setType] = useState<EmailType>("acknowledgement");
  const [draft, setDraft] = useState<{ subject: string; body: string; to: string } | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function draftEmail() {
    setDrafting(true);
    setDraft(null);
    setError("");
    setSent(false);
    try {
      const res = await fetch("/api/hire/candidates/draft-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId, type }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setDraft({ subject: json.subject, body: json.body, to: json.to });
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
      setSent(true);
      setDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow duration-200 space-y-4">
      <h2 className="text-sm font-semibold text-slate-700">Candidate Communications</h2>

      {sent && (
        <p className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">
          ✓ Email sent successfully.
        </p>
      )}

      <div className="flex gap-2">
        {(Object.keys(TYPE_LABELS) as EmailType[]).map((t) => (
          <button
            key={t}
            onClick={() => { setType(t); setDraft(null); setSent(false); }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              type === t
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {!draft ? (
        <button
          onClick={draftEmail}
          disabled={drafting}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {drafting ? "Drafting…" : "Draft with AI"}
        </button>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
            <p className="text-sm text-slate-700">{draft.to}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Subject</label>
            <input
              value={draft.subject}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Body</label>
            <textarea
              rows={8}
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <p className="text-xs text-slate-400 italic">
            Review this email before sending — AI drafted it, you own it.
          </p>
          <div className="flex gap-2">
            <button
              onClick={sendEmail}
              disabled={sending}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {sending ? "Sending…" : "Send Email"}
            </button>
            <button
              onClick={() => setDraft(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
