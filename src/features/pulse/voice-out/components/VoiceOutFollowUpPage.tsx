"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";
import {
  getActiveVoiceOutConversation,
  getSavedVoiceOutConversations,
  markVoiceOutRepliesSeen,
  removeVoiceOutConversation,
  setActiveVoiceOutConversation,
  type SavedVoiceOutConversation,
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

function topicLabel(topic: string) {
  return topic.charAt(0).toUpperCase() + topic.slice(1);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatMessageDate(value: string) {
  return new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function VoiceOutFollowUpPage() {
  const [code, setCode] = useState("");
  const [thread, setThread] = useState<Thread | null>(null);
  const [message, setMessage] = useState("");
  const [savedConversations, setSavedConversations] = useState<
    SavedVoiceOutConversation[]
  >([]);
  const [codeToForget, setCodeToForget] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refreshSavedConversations = useCallback(() => {
    setSavedConversations(getSavedVoiceOutConversations());
  }, []);

  const load = useCallback(
    async (codeToLoad: string) => {
      const normalizedCode = codeToLoad.trim();
      if (!normalizedCode) return;
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/pulse/voice-out/thread?code=${encodeURIComponent(normalizedCode)}`,
        );
        const data = (await response.json()) as Thread & { error?: string };
        if (!response.ok) throw new Error(data.error);
        setThread(data);
        setCode(normalizedCode);
        setActiveVoiceOutConversation(normalizedCode);
        markVoiceOutRepliesSeen(
          normalizedCode,
          data.messages.filter((item) => item.author_role === "hr").length,
        );
        refreshSavedConversations();
      } catch (reason) {
        setThread(null);
        setError(
          reason instanceof Error
            ? reason.message
            : "We could not load this conversation.",
        );
      } finally {
        setLoading(false);
      }
    },
    [refreshSavedConversations],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(refreshSavedConversations);
    const savedCode = getActiveVoiceOutConversation();
    if (savedCode) void Promise.resolve().then(() => load(savedCode));
    // The selected code is intentionally browser-only; it is never placed in a URL.
    return () => window.cancelAnimationFrame(frame);
  }, [load, refreshSavedConversations]);

  async function send() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/pulse/voice-out/thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, message }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error);
      setMessage("");
      await load(code);
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

  function forgetConversation() {
    if (!codeToForget) return;
    removeVoiceOutConversation(codeToForget);
    if (codeToForget === code) {
      setCode("");
      setThread(null);
      setMessage("");
    }
    setCodeToForget(null);
    refreshSavedConversations();
  }

  return (
    <>
      <SetPageHeader
        title="Private follow-up"
        description="Continue an anonymous Voice Out conversation without revealing your identity."
        icon="solar:chat-round-dots-broken"
        actions={[
          {
            label: "New Voice Out",
            icon: "solar:pen-new-square-broken",
            variant: "secondary",
            href: "/pulse/voice-out",
          },
        ]}
      />
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <main className="min-w-0 space-y-5">
          {!thread ? (
            <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20">
              <div className="border-b border-[var(--border)] bg-gradient-to-br from-brand-500/10 via-brand-500/[0.03] to-transparent px-5 py-6 sm:px-7">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-500">
                  <Icon icon="solar:incognito-broken" className="h-5 w-5" />
                </span>
                <h2 className="mt-4 text-lg font-semibold text-[var(--text-hi)]">
                  Open a private conversation
                </h2>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-[var(--text-lo)]">
                  Paste the private code you received after sending a Voice Out
                  report. Kazi does not connect this code to your account.
                </p>
              </div>
              <div className="p-5 sm:p-7">
                <label
                  htmlFor="voice-out-code"
                  className="text-sm font-semibold text-[var(--text-hi)]"
                >
                  Private access code
                </label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    id="voice-out-code"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    placeholder="Paste the code you saved"
                    className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 font-mono text-sm text-[var(--text-hi)] outline-none transition-colors focus:border-brand-500/60"
                  />
                  <Button
                    loading={loading}
                    disabled={!code.trim()}
                    icon="solar:chat-round-dots-broken"
                    onClick={() => void load(code)}
                  >
                    Open conversation
                  </Button>
                </div>
                {error && (
                  <p
                    role="alert"
                    className="mt-3 text-xs font-medium text-red-500"
                  >
                    {error}
                  </p>
                )}
              </div>
            </section>
          ) : (
            <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20">
              <header className="border-b border-[var(--border)] bg-gradient-to-r from-brand-500/10 to-transparent px-5 py-5 sm:px-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
                      <Icon icon="solar:incognito-broken" className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-hi)]">
                        Anonymous conversation
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-lo)]">
                        Started {formatDate(thread.report.created_at)}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-lg bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold capitalize text-[var(--text-lo)] ring-1 ring-[var(--border)]">
                    {thread.report.status.replace("_", " ")}
                  </span>
                </div>
                <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">
                    {topicLabel(thread.report.topic)}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-hi)]">
                    {thread.report.message}
                  </p>
                </div>
              </header>
              <div className="max-h-[min(48vh,34rem)] space-y-3 overflow-y-auto p-5 sm:p-7">
                {thread.messages.length ? (
                  thread.messages.map((item) => (
                    <div
                      key={item.id}
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${item.author_role === "hr" ? "bg-brand-500/[0.08] text-[var(--text-hi)]" : "ml-auto bg-[var(--surface-2)] text-[var(--text-hi)]"}`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-lo)]">
                          {item.author_role === "hr" ? "HR team" : "You"}
                        </p>
                        <time className="text-[10px] text-[var(--text-lo)]">
                          {formatMessageDate(item.created_at)}
                        </time>
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
                        {item.message}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)]/50 p-6 text-center">
                    <Icon
                      icon="solar:chat-round-dots-broken"
                      className="mx-auto h-5 w-5 text-[var(--text-lo)]"
                    />
                    <p className="mt-2 text-sm font-medium text-[var(--text-hi)]">
                      No messages yet
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-lo)]">
                      HR can reply here without learning who you are.
                    </p>
                  </div>
                )}
              </div>
              <footer className="border-t border-[var(--border)] bg-[var(--surface-2)]/40 p-5 sm:p-7">
                <label
                  htmlFor="voice-out-reply"
                  className="text-sm font-semibold text-[var(--text-hi)]"
                >
                  Reply anonymously
                </label>
                <p className="mt-1 text-xs text-[var(--text-lo)]">
                  Your identity remains private. Keep your message under 2,000
                  characters.
                </p>
                <textarea
                  id="voice-out-reply"
                  rows={3}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Write a reply…"
                  className="mt-3 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-hi)] outline-none transition-colors focus:border-brand-500/60"
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-[var(--text-lo)]">
                    {message.length}/2,000
                  </span>
                  <Button
                    loading={loading}
                    disabled={!message.trim() || message.length > 2000}
                    icon="solar:plain-2-broken"
                    onClick={() => void send()}
                  >
                    Send reply
                  </Button>
                </div>
                {error && (
                  <p
                    role="alert"
                    className="mt-3 text-xs font-medium text-red-500"
                  >
                    {error}
                  </p>
                )}
              </footer>
            </section>
          )}
        </main>
        <aside className="space-y-4 lg:sticky lg:top-5">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl shadow-slate-200/40 dark:shadow-black/20">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--text-hi)]">
                  Private conversations
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-lo)]">
                  Saved only in this browser.
                </p>
              </div>
              <span className="rounded-lg bg-brand-500/10 px-2 py-1 text-xs font-bold text-brand-500">
                {savedConversations.length}
              </span>
            </div>
            {savedConversations.length ? (
              <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
                {savedConversations.map((conversation) => {
                  const active = conversation.code === code;
                  return (
                    <div
                      key={conversation.code}
                      className={`group flex items-center gap-2 rounded-xl border p-2 transition-colors ${active ? "border-brand-500/40 bg-brand-500/[0.06]" : "border-[var(--border)] bg-[var(--surface-2)] hover:border-brand-500/30"}`}
                    >
                      <button
                        type="button"
                        onClick={() => void load(conversation.code)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-hi)]">
                          <Icon
                            icon="solar:chat-round-dots-broken"
                            className="h-3.5 w-3.5 text-brand-500"
                          />
                          {active
                            ? "Open conversation"
                            : "Private conversation"}
                        </span>
                        <span className="mt-1 block font-mono text-[10px] text-[var(--text-lo)]">
                          Saved {formatDate(conversation.savedAt)}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCodeToForget(conversation.code)}
                        aria-label="Forget this private conversation from this browser"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-lo)] opacity-100 transition-colors hover:bg-red-500/10 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <Icon
                          icon="solar:trash-bin-trash-broken"
                          className="h-3.5 w-3.5"
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)]/50 p-4">
                <p className="text-xs leading-relaxed text-[var(--text-lo)]">
                  Conversations you choose to save after submitting a report
                  will appear here.
                </p>
              </div>
            )}
          </section>
          <section className="rounded-2xl border border-blue-500/15 bg-blue-500/[0.05] p-4">
            <div className="flex gap-2.5">
              <Icon
                icon="solar:shield-check-broken"
                className="mt-0.5 h-4 w-4 shrink-0 text-blue-600"
              />
              <p className="text-xs leading-relaxed text-[var(--text-lo)]">
                Remove this shortcut from this device at any time. Your report
                stays with HR and can still be reopened with your private code.
              </p>
            </div>
          </section>
          <Link
            href="/pulse/voice-out"
            className="inline-flex items-center gap-1.5 px-1 text-xs font-semibold text-brand-500"
          >
            <Icon icon="solar:alt-arrow-left-broken" className="h-4 w-4" />
            Back to Voice Out
          </Link>
        </aside>
      </div>
      <SimpleModal
        open={Boolean(codeToForget)}
        onClose={() => setCodeToForget(null)}
        title="Forget private conversation?"
        icon="solar:trash-bin-trash-broken"
        subtitle="This removes the conversation shortcut from this device."
      >
        <p className="text-sm leading-relaxed text-[var(--text-lo)]">
          You can reopen it later with your private code. Your report remains
          available to the HR team.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCodeToForget(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={forgetConversation}>
            Remove from this device
          </Button>
        </div>
      </SimpleModal>
    </>
  );
}
