"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import type { OneOnOne } from "@/types/database";

type ActionItem = { text: string; done: boolean; carried_from?: string };

interface Props {
  session: OneOnOne;
  managerName: string;
  reportName: string;
  managerAvatar: string | null;
  reportAvatar: string | null;
  isManager: boolean;
}

const inputClass =
  "w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-3 text-sm leading-relaxed text-[var(--text-hi)] placeholder:text-[var(--text-lo)] outline-none transition focus:border-brand-500 focus:bg-[var(--surface)] focus:ring-2 focus:ring-brand-500/20";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function ParticipantAvatar({
  name,
  avatar,
  className,
}: {
  name: string;
  avatar: string | null;
  className: string;
}) {
  return (
    <span
      className={`relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border-2 border-[var(--surface)] text-sm font-bold text-white ${className}`}
    >
      {avatar ? (
        <Image
          src={avatar}
          alt={name}
          fill
          sizes="48px"
          className="object-cover"
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function OneOnOneDetail({
  session: session,
  managerName,
  reportName,
  managerAvatar,
  reportAvatar,
  isManager,
}: Props) {
  const router = useRouter();
  const [agenda, setAgenda] = useState(session.agenda ?? "");
  const [notes, setNotes] = useState(session.notes ?? "");
  const [items, setItems] = useState<ActionItem[]>(session.action_items ?? []);
  const [newItem, setNewItem] = useState("");
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [talkingPoints, setTalkingPoints] = useState(
    session.ai_talking_points ?? "",
  );

  const date = session.scheduled_at
    ? new Date(session.scheduled_at).toLocaleDateString("en-KE", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Schedule a time to meet";
  const completed = items.filter((item) => item.done).length;
  const open = items.length - completed;
  const completion = items.length
    ? Math.round((completed / items.length) * 100)
    : 0;
  const isDirty =
    agenda !== (session.agenda ?? "") ||
    notes !== (session.notes ?? "") ||
    JSON.stringify(items) !== JSON.stringify(session.action_items ?? []);
  const relation = isManager
    ? `Your direct report · ${reportName}`
    : `Your manager · ${managerName}`;

  const actionLabel = useMemo(
    () => `${open} open action item${open === 1 ? "" : "s"}`,
    [open],
  );

  async function save() {
    setSaving(true);
    try {
      const response = await fetch(`/api/pulse/one-on-ones/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agenda, notes, action_items: items }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error ?? "Could not save this conversation.");
      toast.success("1-on-1 saved.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save this conversation.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function generateTalkingPoints() {
    setAiLoading(true);
    try {
      const response = await fetch("/api/pulse/talking-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oneOnOneId: session.id }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        points?: string;
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error ?? "Could not prepare talking points.");
      setTalkingPoints(data.points ?? "");
      toast.success("Talking points are ready.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not prepare talking points.",
      );
    } finally {
      setAiLoading(false);
    }
  }

  function addItem() {
    const text = newItem.trim();
    if (!text) return;
    setItems((current) => [...current, { text, done: false }]);
    setNewItem("");
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-8">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/pulse/one-on-ones"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-lo)] transition-colors hover:text-brand-500"
        >
          <Icon icon="solar:alt-arrow-left-broken" className="h-4 w-4" /> All
          1-on-1s
        </Link>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--text-lo)]">
          <Icon
            icon={
              session.scheduled_at
                ? "solar:calendar-broken"
                : "solar:calendar-mark-broken"
            }
            className="h-3.5 w-3.5 text-brand-500"
          />{" "}
          {date}
        </span>
      </div>

      <section className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:px-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex -space-x-2.5">
              <ParticipantAvatar
                name={managerName}
                avatar={managerAvatar}
                className="bg-slate-700"
              />
              <ParticipantAvatar
                name={reportName}
                avatar={reportAvatar}
                className="bg-gradient-to-br from-brand-500 to-orange-400"
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold capitalize text-brand-500">
                1-on-1 workspace
              </p>
              <h1 className="mt-1 truncate text-xl font-semibold text-[var(--text-hi)] sm:text-2xl">
                {managerName}{" "}
                <span className="text-[var(--text-lo)]">&amp;</span>{" "}
                {reportName}
              </h1>
              <p className="mt-1 text-sm text-[var(--text-lo)]">{relation}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isDirty && (
              <span className="hidden text-xs font-medium text-amber-600 sm:block">
                Unsaved changes
              </span>
            )}
            <Button
              icon="solar:diskette-broken"
              loading={saving}
              disabled={saving || !isDirty}
              onClick={save}
            >
              Save changes
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="space-y-5">
          <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20">
            <div className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                  <Icon icon="solar:magic-stick-3-broken" className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-[var(--text-hi)]">
                    Conversation prep
                  </h2>
                  <p className="mt-0.5 text-xs text-[var(--text-lo)]">
                    Use recent pulse and follow-through to guide the discussion.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                icon="solar:stars-minimalistic-broken"
                loading={aiLoading}
                onClick={generateTalkingPoints}
              >
                {talkingPoints ? "Refresh prep" : "Generate prep"}
              </Button>
            </div>
            <div className="p-5 sm:p-6">
              {talkingPoints ? (
                <div className="rounded-xl bg-brand-500/[0.06] px-4 py-4 text-sm leading-7 text-[var(--text-hi)] whitespace-pre-wrap">
                  {talkingPoints}
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-xl bg-[var(--surface-2)] px-4 py-4">
                  <Icon
                    icon="solar:lightbulb-bolt-broken"
                    className="mt-0.5 h-5 w-5 shrink-0 text-brand-500"
                  />
                  <p className="text-sm leading-relaxed text-[var(--text-lo)]">
                    Generate a short, private discussion guide from recent
                    check-ins and open action items.
                  </p>
                </div>
              )}
            </div>
          </section>

          <EditorSection
            icon="solar:list-check-broken"
            title="Shared agenda"
            description="Both people can add the topics that matter before the conversation."
          >
            <textarea
              rows={6}
              value={agenda}
              onChange={(event) => setAgenda(event.target.value)}
              placeholder="Add talking points, decisions to make, or support you need…"
              className={inputClass}
            />
          </EditorSection>

          <EditorSection
            icon="solar:notes-broken"
            title="Meeting notes"
            description="Capture decisions, context, and follow-ups while they are fresh."
          >
            <textarea
              rows={8}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Write shared notes from the conversation…"
              className={inputClass}
            />
          </EditorSection>
        </main>

        <aside className="space-y-5">
          <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20 xl:sticky xl:top-5">
            <div className="border-b border-[var(--border)] px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                    <Icon
                      icon="solar:checklist-minimalistic-broken"
                      className="h-4 w-4"
                    />
                  </span>
                  <h2 className="text-sm font-semibold text-[var(--text-hi)]">
                    Action items
                  </h2>
                </div>
                <span className="rounded-full bg-[var(--surface-2)] px-2 py-1 font-mono text-[10px] font-semibold text-[var(--text-lo)]">
                  {actionLabel}
                </span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-orange-400 transition-all"
                  style={{ width: `${completion}%` }}
                />
              </div>
            </div>
            <div className="max-h-[420px] space-y-2 overflow-y-auto p-3">
              {items.length ? (
                items.map((item, index) => (
                  <div
                    key={`${item.text}-${index}`}
                    className="group flex items-start gap-2.5 rounded-xl px-2.5 py-2.5 hover:bg-[var(--surface-2)]"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setItems((current) =>
                          current.map((entry, itemIndex) =>
                            itemIndex === index
                              ? { ...entry, done: !entry.done }
                              : entry,
                          ),
                        )
                      }
                      aria-label={
                        item.done
                          ? "Mark action item open"
                          : "Mark action item complete"
                      }
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${item.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-[var(--border)] bg-[var(--surface)] hover:border-brand-500"}`}
                    >
                      {item.done && (
                        <Icon
                          icon="solar:check-read-broken"
                          className="h-3.5 w-3.5"
                        />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm leading-5 ${item.done ? "text-[var(--text-lo)] line-through" : "text-[var(--text-hi)]"}`}
                      >
                        {item.text}
                      </p>
                      {item.carried_from && !item.done && (
                        <p className="mt-1 text-[10px] font-medium text-amber-600">
                          Carried over
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      aria-label="Remove action item"
                      onClick={() =>
                        setItems((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                      className="invisible rounded-md p-1 text-[var(--text-lo)] hover:bg-red-500/10 hover:text-red-500 group-hover:visible"
                    >
                      <Icon
                        icon="solar:trash-bin-minimalistic-broken"
                        className="h-3.5 w-3.5"
                      />
                    </button>
                  </div>
                ))
              ) : (
                <div className="px-3 py-8 text-center">
                  <Icon
                    icon="solar:checklist-minimalistic-broken"
                    className="mx-auto h-5 w-5 text-[var(--text-lo)]"
                  />
                  <p className="mt-2 text-xs text-[var(--text-lo)]">
                    No follow-ups yet.
                  </p>
                </div>
              )}
            </div>
            <div className="border-t border-[var(--border)] p-3">
              <div className="flex gap-2">
                <input
                  value={newItem}
                  onChange={(event) => setNewItem(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && addItem()}
                  placeholder="Add a follow-up…"
                  className="min-w-0 flex-1 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-hi)] outline-none placeholder:text-[var(--text-lo)] focus:ring-2 focus:ring-brand-500/20"
                />
                <Button
                  size="sm"
                  icon="solar:add-circle-broken"
                  disabled={!newItem.trim()}
                  onClick={addItem}
                >
                  Add
                </Button>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function EditorSection({
  icon,
  title,
  description,
  children,
}: {
  icon: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20">
      <div className="border-b border-[var(--border)] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
            <Icon icon={icon} className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-hi)]">
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-lo)]">
              {description}
            </p>
          </div>
        </div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}
