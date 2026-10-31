"use client";
/* eslint-disable @next/next/no-img-element -- attachments are dynamic R2 images. */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { useFileDrop } from "@/lib/useFileDrop";
import {
  getSavedVoiceOutConversations,
  saveVoiceOutConversation,
  setActiveVoiceOutConversation,
} from "@/lib/voice-out-inbox";

type Topic = "workplace" | "wellbeing" | "inclusion" | "leadership" | "other";

const topics: {
  value: Topic;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    value: "workplace",
    label: "Workplace",
    description: "Workload, ways of working, or a concern at work",
    icon: "solar:case-round-broken",
  },
  {
    value: "wellbeing",
    label: "Wellbeing",
    description: "Support, safety, or your experience at work",
    icon: "solar:heart-pulse-broken",
  },
  {
    value: "inclusion",
    label: "Inclusion",
    description: "Fairness, belonging, or respect",
    icon: "solar:users-group-two-rounded-broken",
  },
  {
    value: "leadership",
    label: "Leadership",
    description: "A team or leadership concern",
    icon: "solar:crown-minimalistic-broken",
  },
  {
    value: "other",
    label: "Something else",
    description: "Anything that does not fit the options above",
    icon: "solar:chat-round-dots-broken",
  },
];

const sentiments = [
  { value: "negative", label: "Frustrated", emoji: "😟" },
  { value: "neutral", label: "Neutral", emoji: "😐" },
  { value: "positive", label: "Positive", emoji: "🙂" },
] as const;

const MAX_ATTACHMENTS = 3;
const MIN_MESSAGE = 20;
const MAX_MESSAGE = 2000;

type PrivateConversation = {
  code: string;
  topic: string;
  message: string;
  status: string;
  createdAt: string;
  hrReplies: number;
  unreadReplies: number;
  lastReply: string | null;
};

export function VoiceOutForm() {
  const router = useRouter();
  const [topic, setTopic] = useState<Topic>("workplace");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [allowsFollowUp, setAllowsFollowUp] = useState(false);
  const [sentiment, setSentiment] =
    useState<(typeof sentiments)[number]["value"]>("neutral");
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [unreadReplies, setUnreadReplies] = useState(0);
  const [privateConversations, setPrivateConversations] = useState<
    PrivateConversation[]
  >([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const attachmentsFull = attachments.length >= MAX_ATTACHMENTS;
  const { isDragging, dropProps } = useFileDrop({
    accept: "image/*",
    disabled: uploading || attachmentsFull,
    onFiles: ([file]) => void upload(file),
  });

  useEffect(() => {
    const conversations = getSavedVoiceOutConversations();
    if (!conversations.length) return;
    let cancelled = false;
    void Promise.all(
      conversations.map(async (conversation) => {
        const response = await fetch(
          `/api/pulse/voice-out/thread?code=${encodeURIComponent(conversation.code)}`,
        );
        if (!response.ok) return null;
        const data = (await response.json()) as {
          report: {
            topic: string;
            message: string;
            status: string;
            created_at: string;
          };
          messages?: {
            author_role: "staff" | "hr";
            message: string;
            created_at: string;
          }[];
        };
        const hrMessages = (data.messages ?? []).filter(
          (message) => message.author_role === "hr",
        );
        return {
          code: conversation.code,
          topic: data.report.topic,
          message: data.report.message,
          status: data.report.status,
          createdAt: data.report.created_at,
          hrReplies: hrMessages.length,
          unreadReplies: Math.max(
            0,
            hrMessages.length - conversation.seenHrReplies,
          ),
          lastReply: hrMessages.at(-1)?.message ?? null,
        } satisfies PrivateConversation;
      }),
    ).then((updates) => {
      if (cancelled) return;
      const active = updates.filter(
        (conversation): conversation is PrivateConversation =>
          conversation !== null,
      );
      setPrivateConversations(active);
      setUnreadReplies(
        active.reduce(
          (total, conversation) => total + conversation.unreadReplies,
          0,
        ),
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function upload(file: File) {
    if (attachments.length >= MAX_ATTACHMENTS) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/pulse/voice-out/upload", {
        method: "POST",
        body: form,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(data?.error ?? "We could not upload that image.");
      setAttachments((current) => [...current, data.url]);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "We could not upload that image.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/pulse/voice-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          message,
          attachments,
          allows_follow_up: allowsFollowUp,
          sentiment,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(data?.error ?? "We could not submit your feedback.");
      setMessage("");
      setAttachments([]);
      setSent(true);
      setAccessCode(data?.accessCode ?? null);
      if (data?.accessCode) saveVoiceOutConversation(data.accessCode);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "We could not submit your feedback.",
      );
    } finally {
      setSaving(false);
    }
  }

  function startAnother() {
    setSent(false);
    setAccessCode(null);
    setTopic("workplace");
    setSentiment("neutral");
    setAllowsFollowUp(false);
  }

  function openPrivateConversation(code: string) {
    setActiveVoiceOutConversation(code);
    router.push("/pulse/voice-out/follow-up");
  }

  if (sent) {
    return (
      <section className="overflow-hidden rounded-2xl border border-emerald-500/20 bg-[var(--surface)] shadow-xl shadow-slate-200/50 dark:shadow-black/20">
        <div className="bg-gradient-to-br from-brand-500/15 via-brand-500/5 to-transparent p-6 sm:p-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-orange-400 text-white shadow-lg shadow-brand-500/25">
            <Icon icon="solar:check-circle-broken" className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-[var(--text-hi)]">
            Thank you. Your report is in.
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-[var(--text-lo)]">
            The HR team will review this theme. Nothing about your account was
            saved with it.
          </p>
        </div>
        {accessCode && (
          <div className="space-y-3 border-t border-[var(--border)] p-6 sm:p-8">
            <p className="text-sm font-semibold text-[var(--text-hi)]">
              Your private follow-up code
            </p>
            <p className="text-xs leading-relaxed text-[var(--text-lo)]">
              Save this code somewhere private. It is the only way to read or
              send anonymous replies, and Kazi cannot recover it.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 break-all rounded-xl bg-[var(--surface-2)] px-4 py-3 font-mono text-sm font-semibold text-[var(--text-hi)]">
                {accessCode}
              </code>
              <Button
                variant="secondary"
                icon="solar:copy-broken"
                onClick={() => {
                  void navigator.clipboard.writeText(accessCode);
                  toast.success("Code copied");
                }}
              >
                Copy code
              </Button>
            </div>
            <Button
              className="w-full sm:w-auto"
              icon="solar:chat-round-dots-broken"
              onClick={() => openPrivateConversation(accessCode)}
            >
              Open private conversation
            </Button>
          </div>
        )}
        <div className="border-t border-[var(--border)] p-6 sm:p-8">
          <Button variant="secondary" onClick={startAnother}>
            Send another report
          </Button>
        </div>
      </section>
    );
  }

  const canSubmit =
    !saving &&
    !uploading &&
    message.trim().length >= MIN_MESSAGE &&
    message.length <= MAX_MESSAGE;

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/50 dark:shadow-black/20">
      {unreadReplies > 0 && (
        <div className="flex items-center justify-between gap-3 border-b border-blue-500/15 bg-blue-500/[0.05] px-6 py-3">
          <p className="text-xs font-semibold text-[var(--text-hi)]">
            HR has replied to {unreadReplies} private{" "}
            {unreadReplies === 1 ? "conversation" : "conversations"}.
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => router.push("/pulse/voice-out/follow-up")}
          >
            Open inbox
          </Button>
        </div>
      )}
      {privateConversations.length > 0 && (
        <div className="border-b border-[var(--border)] bg-[var(--surface-2)]/50 px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--text-hi)]">
                Your private conversations
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-lo)]">
                Saved anonymously in this browser. HR cannot see who owns them.
              </p>
            </div>
            <span className="rounded-lg bg-[var(--surface)] px-2 py-1 text-xs font-semibold text-[var(--text-lo)]">
              {privateConversations.length}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {privateConversations.map((conversation) => (
              <button
                key={conversation.code}
                type="button"
                onClick={() => openPrivateConversation(conversation.code)}
                className="flex w-full items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left transition-colors hover:border-brand-500/30"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                  <Icon
                    icon="solar:chat-round-dots-broken"
                    className="h-4 w-4"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-semibold capitalize text-[var(--text-hi)]">
                      {conversation.topic}
                    </span>
                    {conversation.unreadReplies > 0 && (
                      <span className="rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold text-blue-600">
                        HR replied
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-[var(--text-lo)]">
                    {conversation.lastReply ?? conversation.message}
                  </span>
                </span>
                <Icon
                  icon="solar:alt-arrow-right-broken"
                  className="h-4 w-4 text-[var(--text-lo)]"
                />
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-7 p-6">
        <fieldset>
          <legend className="text-sm font-semibold text-[var(--text-hi)]">
            What is this about?
          </legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {topics.map((item) => {
              const active = topic === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setTopic(item.value)}
                  aria-pressed={active}
                  className={`group flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${active ? "border-brand-500/40 bg-brand-500/[0.06] shadow-sm" : "border-[var(--border)] bg-[var(--surface-2)] hover:-translate-y-0.5 hover:bg-[var(--surface)]"}`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? "bg-brand-500 text-white" : "bg-[var(--surface)] text-brand-500"}`}
                  >
                    <Icon icon={item.icon} className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-[var(--text-hi)]">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-[var(--text-lo)]">
                      {item.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div>
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="voice-out-message"
              className="text-sm font-semibold text-[var(--text-hi)]"
            >
              Your message
            </label>
            <span
              className={`font-mono text-[10px] ${message.length > MAX_MESSAGE ? "text-red-500" : "text-[var(--text-lo)]"}`}
            >
              {message.length}/{MAX_MESSAGE}
            </span>
          </div>
          <textarea
            id="voice-out-message"
            rows={7}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Describe what happened, how it is affecting staff, and what would help…"
            className="mt-2 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm leading-relaxed text-[var(--text-hi)] outline-none transition focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/20"
          />
          <p className="mt-1.5 text-sm text-[var(--text-lo)]">
            At least {MIN_MESSAGE} characters so the HR team has enough to work
            with.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-[var(--text-hi)]">
            Screenshots{" "}
            <span className="font-normal text-[var(--text-lo)]">
              Optional, up to {MAX_ATTACHMENTS}
            </span>
          </p>
          <div
            className={`mt-2 grid gap-3 rounded-xl p-1 ring-2 transition-shadow sm:grid-cols-3 ${isDragging ? "ring-brand-500" : "ring-transparent"}`}
            {...dropProps}
          >
            {attachments.map((url, index) => (
              <div
                key={url}
                className="group relative aspect-video overflow-hidden rounded-xl border border-[var(--border)]"
              >
                <img
                  src={url}
                  alt={`Screenshot ${index + 1}`}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() =>
                    setAttachments((current) =>
                      current.filter((item) => item !== url),
                    )
                  }
                  className="absolute right-2 top-2 rounded-lg bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Remove screenshot"
                >
                  <Icon icon="solar:close-circle-broken" className="h-4 w-4" />
                </button>
              </div>
            ))}
            {attachments.length < MAX_ATTACHMENTS && (
              <button
                type="button"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
                className="flex aspect-video flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-lo)] transition-colors hover:border-brand-500/40 hover:text-brand-500 disabled:opacity-60"
              >
                <Icon
                  icon={
                    uploading
                      ? "solar:refresh-broken"
                      : "solar:gallery-add-broken"
                  }
                  className={`h-5 w-5 ${uploading ? "animate-spin" : ""}`}
                />
                <span className="text-[11px] font-medium">
                  {uploading ? "Uploading…" : "Add or drop image"}
                </span>
              </button>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.currentTarget.value = "";
            }}
          />
        </div>

        <fieldset>
          <legend className="text-sm font-semibold text-[var(--text-hi)]">
            How does this feel?{" "}
            <span className="font-normal text-[var(--text-lo)]">Optional</span>
          </legend>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {sentiments.map((item) => {
              const active = sentiment === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setSentiment(item.value)}
                  aria-pressed={active}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-3 transition-all ${active ? "border-brand-500/40 bg-brand-500/[0.06]" : "border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface)]"}`}
                >
                  <span className="text-2xl">{item.emoji}</span>
                  <span className="text-xs font-medium text-[var(--text-hi)]">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-blue-500/15 bg-blue-500/[0.04] p-4">
          <input
            type="checkbox"
            checked={allowsFollowUp}
            onChange={(event) => setAllowsFollowUp(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[var(--border)] text-brand-500 focus:ring-brand-500"
          />
          <span>
            <span className="block text-sm font-semibold text-[var(--text-hi)]">
              Allow anonymous follow-up
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-[var(--text-lo)]">
              HR can reply through a private code you receive after sending.
              Without this, the report stays one-way.
            </span>
          </span>
        </label>

        {error && (
          <p role="alert" className="text-xs font-medium text-red-500">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-[var(--border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-relaxed text-[var(--text-lo)]">
            In an emergency, use your safeguarding or emergency channels
            instead.
          </p>
          <Button
            icon="solar:plain-2-broken"
            loading={saving}
            disabled={!canSubmit}
            onClick={submit}
          >
            Send anonymously
          </Button>
        </div>
      </div>
    </section>
  );
}
