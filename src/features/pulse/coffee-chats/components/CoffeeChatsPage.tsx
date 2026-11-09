"use client";

import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { Button } from "@/components/ui/Button";
import StatCard from "@/components/ui/StatCard";

type Match = {
  id: string;
  status: "proposed" | "accepted" | "skipped" | "rematch_requested";
  user_a_id: string;
  user_b_id: string;
  a?: { name: string } | null;
  b?: { name: string } | null;
};
type Data = {
  optedIn: boolean;
  matches: Match[];
  canGenerate: boolean;
  currentUserId: string;
  calendarLink: string;
  repeatMonths: number;
};
const month = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric",
}).format(new Date());
const initials = (name: string) =>
  name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export default function CoffeeChatsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () =>
    fetch("/api/pulse/coffee-chats")
      .then((response) => response.json())
      .then(setData);
  useEffect(() => {
    void load();
  }, []);
  async function change(body: object, method = "PATCH") {
    setBusy(true);
    const response = await fetch("/api/pulse/coffee-chats", {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "POST" ? undefined : JSON.stringify(body),
    });
    const result = (await response.json().catch(() => null)) as {
      error?: string;
      created?: number;
      message?: string;
    } | null;
    setBusy(false);
    if (!response.ok)
      return toast.error(result?.error ?? "Could not update coffee chats");
    toast.success(
      method === "POST"
        ? result?.created
          ? `${result.created} private matches created`
          : (result?.message ?? "No new matches")
        : "Coffee chat updated",
    );
    void load();
  }
  const match = data?.matches.find((item) =>
    ["proposed", "accepted"].includes(item.status),
  );
  const partner = match
    ? match.user_a_id === data?.currentUserId
      ? match.b?.name
      : match.a?.name
    : null;
  const rematchQueued = data?.matches.some(
    (item) => item.status === "rematch_requested",
  );
  return (
    <>
      <SetPageHeader
        title="Growthpad coffee chats"
        description="Make time for a thoughtful conversation beyond your usual team."
        icon="solar:cup-hot-broken"
        trailing={
          data?.canGenerate ? (
            <Button
              size="sm"
              icon="solar:shuffle-broken"
              loading={busy}
              onClick={() => change({}, "POST")}
            >
              Generate matches
            </Button>
          ) : undefined
        }
      />
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="grid gap-3 sm:grid-cols-3">
          <StatCard
            variant="inline"
            compact
            title="This month"
            value={data?.optedIn ? "Joined" : "Not joined"}
            icon="solar:cup-hot-broken"
            color="orange"
            subtitle={data?.optedIn ? "Ready for a match" : "Join when ready"}
          />
          <StatCard
            variant="inline"
            compact
            title="Your match"
            value={match ? "Ready" : "Waiting"}
            icon="solar:users-group-rounded-broken"
            color="blue"
            subtitle={match ? "Introduced privately" : "No match yet"}
          />
          <StatCard
            variant="inline"
            compact
            title="Pairing reset"
            value={`${data?.repeatMonths ?? 3} months`}
            icon="solar:shield-check-broken"
            color="green"
            subtitle="Recent pairings stay out"
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 transition-all duration-300 hover:shadow-2xl dark:shadow-black/20">
          <div className="grid gap-6 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_25rem] lg:px-6">
            <div className="flex flex-col justify-between gap-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                    <Icon icon="solar:cup-hot-broken" className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-500">
                    {month}
                  </span>
                </div>
                <h2 className="mt-4 text-xl font-semibold tracking-tight text-[var(--text-hi)]">
                  {data?.optedIn
                    ? "Make space for a conversation outside the usual loop."
                    : "A low-pressure way to meet someone new at Growthpad."}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-lo)]">
                  Coffee Chats create one optional monthly introduction across
                  the team. No calendar access, no profile sharing, and no
                  pressure to make it formal.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  disabled={busy}
                  variant={data?.optedIn ? "secondary" : "primary"}
                  size="sm"
                  icon={
                    data?.optedIn
                      ? "solar:check-circle-broken"
                      : "solar:cup-hot-broken"
                  }
                  onClick={() => change({ optedIn: !data?.optedIn })}
                >
                  {data?.optedIn ? "Joined this month" : "Join the next match"}
                </Button>
                {data?.optedIn && (
                  <span className="text-xs text-[var(--text-lo)]">
                    You can opt out at any time.
                  </span>
                )}
              </div>
            </div>
            <aside className="rounded-2xl border border-brand-500/15 bg-brand-500/[0.04] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-500">
                The rhythm
              </p>
              <ol className="mt-3 space-y-3">
                {[
                  ["1", "Opt in", "Join only when you have room."],
                  [
                    "2",
                    "Get introduced",
                    "Both people receive a private Slack DM.",
                  ],
                  ["3", "Meet your way", "Choose a time, skip, or rematch."],
                ].map(([number, title, copy]) => (
                  <li key={number} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[11px] font-bold text-white">
                      {number}
                    </span>
                    <p className="pt-0.5 text-xs leading-5 text-[var(--text-lo)]">
                      <span className="font-semibold text-[var(--text-hi)]">
                        {title}.{" "}
                      </span>
                      {copy}
                    </p>
                  </li>
                ))}
              </ol>
            </aside>
          </div>
        </section>
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
          {match && partner ? (
            <article className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 transition-all duration-300 hover:border-brand-500/35 hover:shadow-2xl dark:shadow-black/20">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-2)]/70 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                    <Icon icon="solar:cup-hot-broken" className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-hi)]">
                      Your {month} connection
                    </p>
                    <p className="text-xs text-[var(--text-lo)]">
                      Introduced privately in Slack
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600">
                  {match.status === "accepted" ? "Accepted" : "Ready to meet"}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-5 p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500 text-sm font-bold text-white">
                    {initials(partner)}
                  </span>
                  <div>
                    <p className="text-base font-semibold text-[var(--text-hi)]">
                      {partner}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-lo)]">
                      Keep it light: 20–30 minutes is enough.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    href={data?.calendarLink ?? "#"}
                    icon="solar:calendar-add-broken"
                  >
                    Find a time
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      change({ matchId: match.id, action: "accept" })
                    }
                  >
                    I’m in
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      change({ matchId: match.id, action: "rematch" })
                    }
                  >
                    Rematch
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      change({ matchId: match.id, action: "skip" })
                    }
                  >
                    Skip
                  </Button>
                </div>
              </div>
            </article>
          ) : (
            <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 transition-all duration-300 hover:border-brand-500/35 hover:shadow-2xl dark:shadow-black/20">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-2)] text-brand-500">
                    <Icon icon="solar:shuffle-broken" className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--text-hi)]">
                      {rematchQueued
                        ? "Your rematch request is queued"
                        : data?.optedIn
                          ? "You’re in the next matching round"
                          : "Your next connection starts here"}
                    </h2>
                    <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--text-lo)]">
                      {rematchQueued
                        ? "We’ll look for another suitable connection in the next matching run."
                        : data?.optedIn
                          ? "When the monthly matches are generated, your private Slack introduction will arrive here and in Slack."
                          : "Join when it suits you. Kazi does not share your profile, calendar, or working schedule."}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-medium text-[var(--text-lo)]">
                  {month}
                </span>
              </div>
              <div className="mt-5 flex items-center gap-2 border-t border-[var(--border)] pt-4 text-xs text-[var(--text-lo)]">
                <Icon
                  icon="solar:letter-broken"
                  className="h-4 w-4 shrink-0 text-brand-500"
                />
                Your introduction will arrive as a private Slack message.
              </div>
            </article>
          )}
          <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                <Icon icon="solar:shield-check-broken" className="h-4 w-4" />
              </span>
              <p className="text-sm font-semibold text-[var(--text-hi)]">
                Pairing guardrails
              </p>
            </div>
            <div className="mt-4 space-y-3">
              {[
                [
                  "Private introduction",
                  "Only your paired colleague is shared.",
                ],
                [
                  "No reporting lines",
                  "Managers and direct reports are excluded.",
                ],
                [
                  String(data?.repeatMonths ?? 3) + "-month reset",
                  "Recent matches are not repeated.",
                ],
              ].map(([title, copy]) => (
                <div
                  key={title}
                  className="border-b border-[var(--border)] pb-3 last:border-0 last:pb-0"
                >
                  <p className="text-xs font-semibold text-[var(--text-hi)]">
                    {title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-lo)]">
                    {copy}
                  </p>
                </div>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </>
  );
}
