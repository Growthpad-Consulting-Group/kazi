"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { Button } from "@/components/ui/Button";
import {
  getActiveVoiceOutConversation,
  markVoiceOutRepliesSeen,
} from "@/lib/voice-out-inbox";

type Thread = {
  report: {
    topic: string;
    message: string;
    status: string;
    created_at: string;
  };
  messages: {
    id: string;
    author_role: "staff" | "hr";
    message: string;
    created_at: string;
  }[];
};

export default function VoiceOutFollowUpPage() {
  const [code, setCode] = useState("");
  const [thread, setThread] = useState<Thread | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function load(codeToLoad = code) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/pulse/voice-out/thread?code=${encodeURIComponent(codeToLoad)}`,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setThread(data);
      setCode(codeToLoad);
      markVoiceOutRepliesSeen(
        codeToLoad,
        data.messages.filter(
          (item: { author_role: "staff" | "hr" }) => item.author_role === "hr",
        ).length,
      );
    } catch (reason) {
      setThread(null);
      setError(
        reason instanceof Error
          ? reason.message
          : "We could not load this thread.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const savedCode = getActiveVoiceOutConversation();
    if (savedCode) void Promise.resolve().then(() => load(savedCode));
    // The selected code is intentionally browser-only; it is never placed in a URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function send() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/pulse/voice-out/thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, message }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage("");
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "We could not send your reply.",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <SetPageHeader
        title="Anonymous follow-up"
        description="Use your private access code to continue a Voice Out conversation."
        icon="solar:chat-round-dots-broken"
      />
      <div className="mx-auto max-w-3xl space-y-5">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20">
          <label
            htmlFor="voice-out-code"
            className="text-xs font-semibold text-[var(--text-hi)]"
          >
            Private access code
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="voice-out-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Paste the code you saved"
              className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 font-mono text-sm text-[var(--text-hi)] outline-none focus:border-brand-500/60"
            />
            <Button loading={loading} disabled={!code.trim()} onClick={load}>
              Open conversation
            </Button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[var(--text-lo)]">
            This browser can remember codes you chose to save. The HR team
            cannot see who owns this conversation.
          </p>
          {error && (
            <p role="alert" className="mt-3 text-xs font-medium text-red-500">
              {error}
            </p>
          )}
        </section>
        {thread && (
          <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20">
            <div className="border-b border-[var(--border)] px-5 py-4">
              <p className="text-xs font-semibold text-brand-500">
                {thread.report.topic}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-hi)]">
                {thread.report.message}
              </p>
            </div>
            <div className="space-y-3 p-5">
              {thread.messages.length ? (
                thread.messages.map((item) => (
                  <div
                    key={item.id}
                    className={`max-w-xl rounded-xl p-3 ${item.author_role === "hr" ? "bg-blue-500/[0.07]" : "ml-auto bg-[var(--surface-2)]"}`}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-lo)]">
                      {item.author_role === "hr" ? "HR team" : "You"}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-hi)]">
                      {item.message}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-center text-xs text-[var(--text-lo)]">
                  No follow-up messages yet.
                </p>
              )}
            </div>
            <div className="border-t border-[var(--border)] p-5">
              <label className="text-xs font-semibold text-[var(--text-hi)]">
                Reply anonymously
              </label>
              <textarea
                rows={3}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Write a reply…"
                className="mt-2 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500/60"
              />
              <div className="mt-3 flex justify-end">
                <Button
                  loading={loading}
                  disabled={!message.trim() || message.length > 2000}
                  onClick={send}
                >
                  Send reply
                </Button>
              </div>
            </div>
          </section>
        )}
        <Link
          href="/pulse/voice-out"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-500"
        >
          <Icon icon="solar:alt-arrow-left-broken" className="h-4 w-4" />
          Back to Voice Out
        </Link>
      </div>
    </>
  );
}
