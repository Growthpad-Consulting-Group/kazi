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
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="grid grid-cols-3 gap-3">
          <StatCard
            variant="inline"
            compact
            title="This month"
            value={data?.optedIn ? "In" : "—"}
            icon="solar:cup-hot-broken"
            color="orange"
            subtitle={data?.optedIn ? "Ready for matching" : "Not opted in"}
          />
          <StatCard
            variant="inline"
            compact
            title="Your connection"
            value={match ? "Ready" : "—"}
            icon="solar:users-group-rounded-broken"
            color="blue"
            subtitle={match ? "Introduced privately" : "No match yet"}
          />
          <StatCard
            variant="inline"
            compact
            title="Pairing policy"
            value={`${data?.repeatMonths ?? 3} mo`}
            icon="solar:shield-check-broken"
            color="green"
            subtitle="No direct reporting lines"
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/50 transition-shadow duration-200 hover:shadow-2xl dark:shadow-black/20">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                <Icon icon="solar:cup-hot-broken" className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-hi)]">
                  Growthpad coffee chats
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-lo)]">
                  An optional monthly conversation with someone beyond your
                  usual team.
                </p>
              </div>
            </div>
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
              {data?.optedIn ? "Opt out" : "Join the next match"}
            </Button>
          </div>
          <div className="grid gap-4 px-5 py-4 text-xs leading-relaxed text-[var(--text-lo)] sm:grid-cols-3">
            <p>
              <span className="font-semibold text-[var(--text-hi)]">
                Private by default.{" "}
              </span>
              Introductions arrive by Slack DM only.
            </p>
            <p>
              <span className="font-semibold text-[var(--text-hi)]">
                Thoughtful pairing.{" "}
              </span>
              Direct reporting lines and recent pairings are excluded.
            </p>
            <p>
              <span className="font-semibold text-[var(--text-hi)]">
                Your choice.{" "}
              </span>
              Pick a time, skip, request a rematch, or opt out any time.
            </p>
          </div>
        </section>
        {match && partner ? (
          <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20">
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
                  onClick={() => change({ matchId: match.id, action: "skip" })}
                >
                  Skip
                </Button>
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20">
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
            <div className="mt-5 grid gap-2 border-t border-[var(--border)] pt-4 sm:grid-cols-3">
              {[
                ["1", "Opt in", "Choose to join whenever you have room."],
                [
                  "2",
                  "Get introduced",
                  "We send both people a private Slack DM.",
                ],
                [
                  "3",
                  "Meet your way",
                  "Pick a time, skip, or ask for a rematch.",
                ],
              ].map(([number, title, copy]) => (
                <div key={number} className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-[10px] font-bold text-brand-500">
                    {number}
                  </span>
                  <p className="text-xs leading-relaxed text-[var(--text-lo)]">
                    <span className="font-semibold text-[var(--text-hi)]">
                      {title}.{" "}
                    </span>
                    {copy}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
