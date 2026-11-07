/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import type { FeedbackWithUsers } from "../actions";

const REACTION_EMOJIS = ["❤️", "🎉", "👏", "🔥"] as const;
type FeedbackReaction = { feedback_id: string; user_id: string; emoji: string };

export function FeedbackWall({
  kudos,
  values,
  reactions: initialReactions,
  currentUserId,
}: {
  kudos: FeedbackWithUsers[];
  values: { id: string; name: string; color: string }[];
  reactions: FeedbackReaction[];
  currentUserId: string;
}) {
  const [reactions, setReactions] = useState(initialReactions);
  const [pending, setPending] = useState<string | null>(null);
  const valueById = new Map(values.map((value) => [value.id, value]));
  const reactionsByFeedback = useMemo(() => {
    const grouped = new Map<string, FeedbackReaction[]>();
    for (const reaction of reactions) {
      grouped.set(reaction.feedback_id, [
        ...(grouped.get(reaction.feedback_id) ?? []),
        reaction,
      ]);
    }
    return grouped;
  }, [reactions]);

  async function toggleReaction(
    feedbackId: string,
    emoji: (typeof REACTION_EMOJIS)[number],
  ) {
    const key = `${feedbackId}:${emoji}`;
    if (pending === key) return;
    const existing = reactions.some(
      (reaction) =>
        reaction.feedback_id === feedbackId &&
        reaction.user_id === currentUserId &&
        reaction.emoji === emoji,
    );
    const optimistic = existing
      ? reactions.filter(
          (reaction) =>
            !(
              reaction.feedback_id === feedbackId &&
              reaction.user_id === currentUserId &&
              reaction.emoji === emoji
            ),
        )
      : [
          ...reactions,
          { feedback_id: feedbackId, user_id: currentUserId, emoji },
        ];
    setPending(key);
    setReactions(optimistic);
    try {
      const response = await fetch(
        `/api/pulse/feedback/${feedbackId}/reactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok)
        throw new Error(payload?.error ?? "Could not update this reaction.");
    } catch (error) {
      setReactions(reactions);
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update this reaction.",
      );
    } finally {
      setPending(null);
    }
  }
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
            <Icon icon="solar:star-fall-broken" className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-hi)]">
              Recognition wall
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-lo)]">
              Specific appreciation makes great work visible.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 font-mono text-[10px] font-semibold text-[var(--text-lo)]">
          {kudos.length} shared
        </span>
      </div>
      {kudos.length ? (
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
          {kudos.map((item) => {
            const value = item.value_id ? valueById.get(item.value_id) : null;
            const itemReactions = reactionsByFeedback.get(item.id) ?? [];
            return (
              <article
                key={item.id}
                className="group rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 transition-colors hover:bg-[var(--surface)]"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-lg">
                    {item.emoji ?? "⭐"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--text-hi)]">
                          {item.to?.name ?? "Teammate"}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-[var(--text-lo)]">
                          From {item.from?.name ?? "A teammate"}
                        </p>
                      </div>
                      <Icon
                        icon="solar:quote-up-broken"
                        className="h-4 w-4 shrink-0 text-brand-500/45"
                      />
                    </div>
                    {value && (
                      <span
                        className="mt-2 inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          backgroundColor: `${value.color}18`,
                          color: value.color,
                        }}
                      >
                        {value.name}
                      </span>
                    )}
                    <p className="mt-3 line-clamp-4 text-xs leading-relaxed text-[var(--text-hi)]">
                      {item.message}
                    </p>
                    {item.media_url && (
                      <img
                        src={item.media_url}
                        alt=""
                        className="mt-3 max-h-48 w-full rounded-xl object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-2.5">
                  <div className="flex flex-wrap items-center gap-1">
                    {REACTION_EMOJIS.map((emoji) => {
                      const count = itemReactions.filter(
                        (reaction) => reaction.emoji === emoji,
                      ).length;
                      const active = itemReactions.some(
                        (reaction) =>
                          reaction.emoji === emoji &&
                          reaction.user_id === currentUserId,
                      );
                      const key = `${item.id}:${emoji}`;
                      return (
                        <button
                          key={emoji}
                          type="button"
                          aria-label={`${active ? "Remove" : "Add"} ${emoji} reaction`}
                          aria-pressed={active}
                          disabled={pending === key}
                          onClick={() => toggleReaction(item.id, emoji)}
                          className={`inline-flex min-h-7 items-center gap-1 rounded-lg px-1.5 text-xs transition-colors disabled:opacity-50 ${active ? "bg-brand-500/10 text-brand-600 dark:text-brand-400" : "text-[var(--text-lo)] hover:bg-[var(--surface)] hover:text-[var(--text-hi)]"}`}
                        >
                          <span aria-hidden>{emoji}</span>
                          {count > 0 && (
                            <span className="font-mono text-[10px]">
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="shrink-0 font-mono text-[10px] text-[var(--text-lo)]">
                    {new Date(item.created_at).toLocaleDateString("en-KE", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="flex min-h-80 flex-col items-center justify-center px-5 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500">
            <Icon icon="solar:star-fall-broken" className="h-5 w-5" />
          </span>
          <h3 className="mt-3 text-base font-semibold text-[var(--text-hi)]">
            Start the recognition
          </h3>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-[var(--text-lo)]">
            Celebrate a teammate&apos;s thoughtful work, a customer win, or the
            help they gave when it mattered.
          </p>
        </div>
      )}
    </section>
  );
}
