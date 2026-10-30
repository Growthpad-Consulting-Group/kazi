"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { hallOfFameChannelName } from "@/lib/hall-of-fame-channel";
import Image from "next/image";
import { Avatar } from "@/components/ui/Avatar";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import SetPageHeader from "@/components/ui/SetPageHeader";
import DateRangePicker, {
  type DateRangeValue,
} from "@/components/ui/DateRangePicker";
import { SimpleModal } from "@/components/ui/SimpleModal";
import { SlideOver } from "@/components/ui/SlideOver";
import StatCard from "@/components/ui/StatCard";
import { MonthSelect } from "./MonthSelect";

type Cycle = {
  id: string;
  month: string;
  status:
    | "draft"
    | "open"
    | "team_voting"
    | "management_voting"
    | "published"
    | "closed";
  opens_at: string | null;
  closes_at: string | null;
} | null;
type Staff = {
  id: string;
  name: string;
  job_title: string | null;
  department: string | null;
  avatar_url: string | null;
};
type Nomination = {
  id: string;
  nominator_id: string;
  nominee_id: string;
  impact_statement: string;
  category: "wow" | "mvp";
  created_at: string;
};
type Vote = {
  nominee_id: string;
  voter_id: string;
  category: "wow" | "mvp";
  score: number;
  stage: "team" | "management";
};
type Winner = {
  id: string;
  nominee_id: string;
  category: "wow" | "mvp";
  team_score: number | null;
  management_score: number | null;
  prize_status: "pending" | "ordered" | "delivered";
};

const CATEGORY_OPTIONS = [
  {
    value: "wow",
    label: "WOW Award",
    description: "Delivered a WOW experience to a client",
    icon: "solar:magic-stick-3-broken",
  },
  {
    value: "mvp",
    label: "MVP of the month",
    description: "Excellent performance this month",
    icon: "solar:medal-ribbon-broken",
  },
] as const;

function monthLabel(month: string) {
  return new Date(`${month}T12:00:00`).toLocaleDateString("en-KE", {
    month: "long",
    year: "numeric",
  });
}

function nominationWindowLabel(cycle: NonNullable<Cycle>) {
  const format = (value: string) =>
    new Date(`${value}T12:00:00`).toLocaleDateString("en-KE", {
      day: "numeric",
      month: "short",
    });
  if (cycle.opens_at && cycle.closes_at)
    return `Nominations: ${format(cycle.opens_at)} – ${format(cycle.closes_at)}`;
  if (cycle.closes_at) return `Closes ${format(cycle.closes_at)}`;
  if (cycle.opens_at) return `Open from ${format(cycle.opens_at)}`;
  return null;
}

function nominationCountdown(cycle: NonNullable<Cycle>) {
  if (!cycle.closes_at) return null;
  const closeAt = new Date(`${cycle.closes_at}T23:59:59`).getTime();
  const days = Math.max(0, Math.ceil((closeAt - Date.now()) / 86_400_000));
  if (days === 0) return { label: "Closes today", urgent: true };
  return {
    label: `${days} day${days === 1 ? "" : "s"} remaining`,
    urgent: days <= 3,
  };
}

function toDateString(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export default function HallOfFameClient({
  currentUserId,
  canManage,
  requiresMonthlyEntry,
  cycle,
  staff,
  nominations,
  votes,
  winners,
}: {
  currentUserId: string;
  canManage: boolean;
  requiresMonthlyEntry: boolean;
  cycle: Cycle;
  staff: Staff[];
  nominations: Nomination[];
  votes: Vote[];
  winners: Winner[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [impact, setImpact] = useState("");
  const [category, setCategory] = useState<"wow" | "mvp">("wow");
  const [score, setScore] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [newCycleOpen, setNewCycleOpen] = useState(false);
  const [month, setMonth] = useState(
    `${new Date().toISOString().slice(0, 7)}-01`,
  );
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const nominationWindow: DateRangeValue = {
    startDate: opensAt ? new Date(`${opensAt}T00:00:00`) : null,
    endDate: closesAt ? new Date(`${closesAt}T00:00:00`) : null,
  };

  const nominationsByNominee = useMemo(
    () =>
      nominations.reduce<Record<string, Nomination[]>>((all, item) => {
        (all[item.nominee_id] ??= []).push(item);
        return all;
      }, {}),
    [nominations],
  );

  const directory = useMemo(
    () =>
      staff
        .filter((member) => {
          const query = search.trim().toLowerCase();
          if (!query) return true;
          return (
            member.name.toLowerCase().includes(query) ||
            (member.job_title ?? "").toLowerCase().includes(query) ||
            (member.department ?? "").toLowerCase().includes(query)
          );
        })
        .sort(
          (a, b) =>
            (nominationsByNominee[b.id]?.length ?? 0) -
              (nominationsByNominee[a.id]?.length ?? 0) ||
            a.name.localeCompare(b.name),
        ),
    [staff, search, nominationsByNominee],
  );

  const selected = staff.find((member) => member.id === selectedId) ?? null;
  const selectedNominations = selected
    ? (nominationsByNominee[selected.id] ?? [])
    : [];
  const nomineeCount = Object.keys(nominationsByNominee).length;
  const yourNominations = nominations.filter(
    (item) => item.nominator_id === currentUserId,
  ).length;
  const hasMonthlyEntry = nominations.some(
    (item) =>
      item.nominator_id === currentUserId && item.nominee_id === currentUserId,
  );
  const isOpen = cycle?.status === "open";
  const activeNominationWindowLabel = cycle
    ? nominationWindowLabel(cycle)
    : null;
  const activeNominationCountdown = cycle ? nominationCountdown(cycle) : null;
  const votingStage =
    cycle?.status === "team_voting"
      ? "team"
      : cycle?.status === "management_voting" && canManage
        ? "management"
        : null;
  const isVoting = votingStage !== null;
  const voteAverages = useMemo(() => {
    const averages = new Map<string, number>();
    for (const option of CATEGORY_OPTIONS) {
      const relevant = votes.filter(
        (vote) => vote.category === option.value && vote.stage === "team",
      );
      const grouped = new Map<string, { total: number; count: number }>();
      for (const vote of relevant) {
        const entry = grouped.get(vote.nominee_id) ?? { total: 0, count: 0 };
        entry.total += vote.score;
        entry.count += 1;
        grouped.set(vote.nominee_id, entry);
      }
      for (const [nomineeId, entry] of grouped) {
        averages.set(`${option.value}:${nomineeId}`, entry.total / entry.count);
      }
    }
    return averages;
  }, [votes]);
  const finalists = useMemo(() => {
    if (votingStage !== "management") return new Set<string>();
    const ids = new Set<string>();
    for (const option of CATEGORY_OPTIONS) {
      [...voteAverages.entries()]
        .filter(([key]) => key.startsWith(`${option.value}:`))
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .forEach(([key]) => ids.add(key.slice(option.value.length + 1)));
    }
    return ids;
  }, [voteAverages, votingStage]);

  const openNominate = (id: string) => {
    setSelectedId(id);
    setImpact("");
    setCategory("wow");
    setScore(null);
  };

  const nominate = async () => {
    if (!cycle || !selected || impact.trim().length < 20) return;
    setSaving(true);
    try {
      const response = await fetch("/api/pulse/hall-of-fame/nominations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycleId: cycle.id,
          nomineeId: selected.id,
          impactStatement: impact,
          category,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success(`Nominated ${selected.name}.`);
      setSelectedId(null);
      setImpact("");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not submit nomination.",
      );
    } finally {
      setSaving(false);
    }
  };

  const createCycle = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/pulse/hall-of-fame/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          opensAt: opensAt || null,
          closesAt: closesAt || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success("Nominations are open.");
      setNewCycleOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not open nominations.",
      );
    } finally {
      setSaving(false);
    }
  };

  const closeCycle = async () => {
    if (!cycle) return;
    setSaving(true);
    try {
      const response = await fetch("/api/pulse/hall-of-fame/cycles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cycle.id, status: "closed" }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      toast.success("Nominations closed.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not close nominations.",
      );
    } finally {
      setSaving(false);
    }
  };

  const updateStage = async (status: "team_voting" | "management_voting") => {
    if (!cycle) return;
    setSaving(true);
    try {
      const response = await fetch("/api/pulse/hall-of-fame/cycles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cycle.id, status }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      toast.success(
        status === "team_voting"
          ? "Team voting is now open."
          : "Management finalist voting is now open.",
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update the cycle.",
      );
    } finally {
      setSaving(false);
    }
  };

  const submitVote = async () => {
    if (!cycle || !selected || !votingStage || !score) return;
    setSaving(true);
    try {
      const response = await fetch("/api/pulse/hall-of-fame/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycleId: cycle.id,
          nomineeId: selected.id,
          category,
          score,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success("Your score has been recorded.");
      setSelectedId(null);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save your vote.",
      );
    } finally {
      setSaving(false);
    }
  };

  const publishWinners = async () => {
    if (!cycle) return;
    setSaving(true);
    try {
      const response = await fetch("/api/pulse/hall-of-fame/winners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleId: cycle.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success("Winners are published and ready for fulfilment.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not publish winners.",
      );
    } finally {
      setSaving(false);
    }
  };

  const updatePrizeStatus = async (
    winnerId: string,
    prizeStatus: Winner["prize_status"],
  ) => {
    setSaving(true);
    try {
      const response = await fetch("/api/pulse/hall-of-fame/winners", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: winnerId, prizeStatus }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success("Prize fulfilment updated.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update prize fulfilment.",
      );
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!cycle) return;
    const channel = supabaseBrowser
      .channel(hallOfFameChannelName(cycle.id))
      .on("broadcast", { event: "changed" }, () => router.refresh())
      .subscribe();
    return () => {
      void supabaseBrowser.removeChannel(channel);
    };
  }, [cycle, router]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <SetPageHeader
        title={
          cycle
            ? `${monthLabel(cycle.month)} · Wall of Fame`
            : "Growthpad Wall of Fame"
        }
        description="Recognise people who create WOW experiences for clients and deliver excellent performance."
        icon="solar:cup-star-broken"
        trailing={
          <>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                isOpen
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                  : "bg-[var(--surface-2)] text-[var(--text-lo)]"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${isOpen ? "bg-emerald-500" : "bg-[var(--text-lo)]"}`}
              />
              {cycle
                ? isOpen
                  ? "Nominations open"
                  : cycle.status === "team_voting"
                    ? "Team voting open"
                    : cycle.status === "management_voting"
                      ? "Management voting"
                      : cycle.status === "published"
                        ? "Winners published"
                        : "Nominations closed"
                : "Nominations not open yet"}
              {isOpen && activeNominationCountdown && (
                <span
                  className={
                    activeNominationCountdown.urgent
                      ? "text-amber-600 dark:text-amber-300"
                      : ""
                  }
                >
                  · {activeNominationCountdown.label}
                </span>
              )}
            </span>
            {isOpen && activeNominationWindowLabel && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-lo)]">
                <Icon icon="solar:calendar-broken" className="h-3.5 w-3.5" />
                {activeNominationWindowLabel}
              </span>
            )}
            {canManage && (
              <div className="flex flex-wrap items-center gap-2">
                {isOpen && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon="solar:users-group-two-rounded-broken"
                    loading={saving}
                    onClick={() => updateStage("team_voting")}
                  >
                    Start team voting
                  </Button>
                )}
                {cycle?.status === "team_voting" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon="solar:medal-ribbon-broken"
                    loading={saving}
                    onClick={() => updateStage("management_voting")}
                  >
                    Start finalist vote
                  </Button>
                )}
                {cycle?.status === "management_voting" && (
                  <Button
                    size="sm"
                    icon="solar:cup-star-broken"
                    loading={saving}
                    onClick={publishWinners}
                  >
                    Publish winners
                  </Button>
                )}
                {cycle?.status === "published" ? null : isOpen ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon="solar:lock-keyhole-broken"
                    loading={saving}
                    onClick={closeCycle}
                  >
                    Close cycle
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    icon="solar:add-circle-broken"
                    loading={saving}
                    onClick={() => setNewCycleOpen(true)}
                  >
                    Open nominations
                  </Button>
                )}
              </div>
            )}
          </>
        }
      />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          variant="inline"
          compact
          title="Nominations"
          value={nominations.length}
          icon="solar:star-fall-broken"
          color="orange"
          subtitle="This award cycle"
        />
        <StatCard
          variant="inline"
          compact
          title="Nominees"
          value={nomineeCount}
          icon="solar:users-group-two-rounded-broken"
          color="green"
          subtitle="Colleagues recognised"
        />
        <StatCard
          variant="inline"
          compact
          title="Your nominations"
          value={yourNominations}
          icon="solar:heart-angle-broken"
          color="blue"
          subtitle="Your voice this month"
        />
        <StatCard
          variant="inline"
          compact
          title="Awards"
          value="WOW · MVP"
          icon="solar:medal-ribbon-broken"
          color="amber"
          subtitle="Client excellence"
        />
      </section>

      {isOpen && requiresMonthlyEntry && !hasMonthlyEntry && (
        <section className="flex flex-col gap-3 rounded-2xl border border-brand-500/20 bg-brand-500/[0.06] p-4 shadow-lg shadow-brand-500/5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white">
              <Icon
                icon="solar:pen-new-square-broken"
                className="h-4.5 w-4.5"
              />
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--text-hi)]">
                Your monthly project entry is needed
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-lo)]">
                Submit one self-nomination in either award category, describing
                the project or work you delivered this month.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            icon="solar:pen-new-square-broken"
            onClick={() => openNominate(currentUserId)}
          >
            Add your entry
          </Button>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/50 transition-shadow duration-200 hover:shadow-2xl dark:shadow-black/20">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-hi)]">
              Staff directory
            </h2>
            <p className="mt-1 text-xs text-[var(--text-lo)]">
              {isOpen
                ? "Select a colleague to nominate them."
                : isVoting
                  ? votingStage === "team"
                    ? "Score a nominee from 1 to 10. You cannot score yourself."
                    : "Management scores the top three team-vote finalists in each award."
                  : "Nominations are closed. Open a cycle to nominate."}
            </p>
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, role or team"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500 sm:w-72"
          />
        </div>
        {directory.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-[var(--text-lo)]">
            No staff match your search.
          </div>
        ) : (
          <div className="grid max-h-[72vh] grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-3 sm:gap-4 sm:p-5 lg:grid-cols-4 xl:grid-cols-5">
            {directory
              .filter(
                (member) =>
                  !isVoting ||
                  votingStage === "team" ||
                  finalists.has(member.id),
              )
              .map((member) => {
                const received = nominationsByNominee[member.id] ?? [];
                const wow = received.filter(
                  (item) => item.category === "wow",
                ).length;
                const mvp = received.filter(
                  (item) => item.category === "mvp",
                ).length;
                const initialsText = member.name
                  .split(" ")
                  .filter(Boolean)
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();
                const isWinner = winners.some(
                  (winner) => winner.nominee_id === member.id,
                );
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => openNominate(member.id)}
                    className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] text-left shadow-lg shadow-slate-200/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl dark:shadow-black/30"
                  >
                    {member.avatar_url ? (
                      <Image
                        src={member.avatar_url}
                        alt={member.name}
                        fill
                        sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-500/30 via-orange-400/20 to-violet-500/20 font-mono text-4xl font-bold text-[var(--text-hi)]/70">
                        {initialsText}
                      </span>
                    )}
                    <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                    {(wow > 0 || mvp > 0) && (
                      <div className="absolute right-2.5 top-2.5 flex flex-col items-end gap-1">
                        {wow > 0 && (
                          <span className="rounded-lg bg-brand-500 px-2 py-0.5 font-mono text-[10px] font-bold text-white shadow-lg">
                            WOW × {wow}
                          </span>
                        )}
                        {mvp > 0 && (
                          <span className="rounded-lg bg-white/90 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-900 shadow-lg">
                            MVP × {mvp}
                          </span>
                        )}
                      </div>
                    )}
                    {isWinner && (
                      <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-lg bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950 shadow-lg">
                        <Icon
                          icon="solar:cup-star-broken"
                          className="h-3 w-3"
                        />
                        Winner
                      </span>
                    )}
                    <div className="absolute inset-x-0 bottom-0 p-3.5">
                      <p className="truncate text-sm font-semibold text-white">
                        {member.name}
                        {member.id === currentUserId ? (
                          <span className="font-normal text-white/60">
                            {" "}
                            (you)
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-white/70">
                        {member.job_title ?? "Team member"}
                      </p>
                      <p className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-white/80 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        {isOpen ? "Nominate" : isVoting ? "Score" : "View"}{" "}
                        <Icon
                          icon="solar:alt-arrow-right-broken"
                          className="h-3 w-3"
                        />
                      </p>
                    </div>
                  </button>
                );
              })}
          </div>
        )}
      </section>

      {winners.length > 0 && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-[var(--text-hi)]">
              Published winners
            </h2>
            <p className="mt-1 text-xs text-[var(--text-lo)]">
              Celebrate the winning work and keep prize fulfilment visible.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {winners.map((winner) => {
              const member = staff.find(
                (candidate) => candidate.id === winner.nominee_id,
              );
              if (!member) return null;
              return (
                <div
                  key={winner.id}
                  className="flex items-center gap-3 rounded-xl bg-[var(--surface-2)] p-3"
                >
                  <Avatar
                    name={member.name}
                    src={member.avatar_url}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--text-hi)]">
                      {member.name}
                    </p>
                    <p className="text-xs text-[var(--text-lo)]">
                      {winner.category === "wow"
                        ? "WOW Award"
                        : "MVP of the month"}
                      {" · "}Management {winner.management_score ?? "—"}/10
                    </p>
                  </div>
                  {canManage ? (
                    <select
                      value={winner.prize_status}
                      disabled={saving}
                      onChange={(event) =>
                        updatePrizeStatus(
                          winner.id,
                          event.target.value as Winner["prize_status"],
                        )
                      }
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs font-semibold text-[var(--text-hi)] outline-none focus:border-brand-500"
                    >
                      <option value="pending">Prize pending</option>
                      <option value="ordered">Prize ordered</option>
                      <option value="delivered">Prize delivered</option>
                    </select>
                  ) : (
                    <span className="rounded-lg bg-emerald-500/10 px-2 py-1 text-xs font-semibold capitalize text-emerald-700 dark:text-emerald-300">
                      {winner.prize_status}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <SlideOver
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        title={selected ? `Nominate ${selected.name}` : "Nominate"}
        subtitle={
          selected
            ? [selected.job_title, selected.department]
                .filter(Boolean)
                .join(" · ") || "Team member"
            : undefined
        }
        icon="solar:star-fall-broken"
      >
        {selected && !isOpen && !isVoting && (
          <div className="rounded-xl bg-[var(--surface-2)] p-4 text-center">
            <Icon
              icon="solar:lock-keyhole-broken"
              className="mx-auto h-5 w-5 text-[var(--text-lo)]"
            />
            <p className="mt-2 text-sm font-semibold text-[var(--text-hi)]">
              Nominations are not open
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-lo)]">
              {canManage
                ? "Open this month’s cycle to start nominating."
                : "Your HR team will open the next Wall of Fame cycle."}
            </p>
          </div>
        )}

        {selected && isOpen && (
          <div className="space-y-5">
            <div className="flex flex-col items-center text-center">
              <Avatar
                name={selected.name}
                src={selected.avatar_url}
                size="xl"
              />
              <p className="mt-3 text-base font-semibold text-[var(--text-hi)]">
                {selected.name}
              </p>
              <p className="text-xs text-[var(--text-lo)]">
                {selected.job_title ?? "Team member"}
                {selected.department ? ` · ${selected.department}` : ""}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCategory(option.value)}
                  className={`rounded-xl border p-3 text-left transition-colors ${category === option.value ? "border-brand-500/40 bg-brand-500/[0.06]" : "border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface)]"}`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${category === option.value ? "bg-brand-500 text-white" : "bg-[var(--surface)] text-brand-500"}`}
                  >
                    <Icon icon={option.icon} className="h-4 w-4" />
                  </span>
                  <span className="mt-2 block text-sm font-semibold text-[var(--text-hi)]">
                    {option.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-[var(--text-lo)]">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>

            <label className="block text-sm font-semibold text-[var(--text-hi)]">
              Impactful work or project
              <textarea
                rows={6}
                value={impact}
                onChange={(event) => setImpact(event.target.value)}
                maxLength={1200}
                placeholder="What did they deliver, and what made the client experience exceptional?"
                className="mt-1.5 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm font-normal leading-relaxed text-[var(--text-hi)] outline-none focus:border-brand-500"
              />
            </label>
            <p className="text-xs leading-relaxed text-[var(--text-lo)]">
              You can nominate yourself, but only once per cycle across both
              awards. Please make the impact specific.
            </p>
            <Button
              className="w-full"
              icon="solar:star-fall-broken"
              loading={saving}
              disabled={impact.trim().length < 20}
              onClick={nominate}
            >
              Submit nomination
            </Button>

            {selectedNominations.length > 0 && (
              <div className="space-y-3 border-t border-[var(--border)] pt-5">
                <p className="text-xs font-semibold text-[var(--text-hi)]">
                  Nominations this cycle ({selectedNominations.length})
                </p>
                {selectedNominations.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl bg-[var(--surface-2)] p-3"
                  >
                    <span className="rounded-md bg-brand-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-brand-500">
                      {item.category === "wow"
                        ? "WOW Award"
                        : "MVP of the month"}
                    </span>
                    <p className="mt-2 text-xs leading-relaxed text-[var(--text-lo)]">
                      {item.impact_statement}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selected && isVoting && (
          <div className="space-y-5">
            <div className="flex flex-col items-center text-center">
              <Avatar
                name={selected.name}
                src={selected.avatar_url}
                size="xl"
              />
              <p className="mt-3 text-base font-semibold text-[var(--text-hi)]">
                {selected.name}
              </p>
              <p className="text-xs text-[var(--text-lo)]">
                {selected.job_title ?? "Team member"}
                {selected.department ? ` · ${selected.department}` : ""}
              </p>
            </div>
            {selected.id === currentUserId ? (
              <div className="rounded-xl bg-[var(--surface-2)] p-4 text-center text-sm text-[var(--text-lo)]">
                Self-voting is not available. Choose another colleague.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setCategory(option.value)}
                      className={`rounded-xl border p-3 text-left transition-colors ${category === option.value ? "border-brand-500/40 bg-brand-500/[0.06]" : "border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface)]"}`}
                    >
                      <span className="text-sm font-semibold text-[var(--text-hi)]">
                        {option.label}
                      </span>
                      <span className="mt-1 block text-xs text-[var(--text-lo)]">
                        {option.description}
                      </span>
                    </button>
                  ))}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-hi)]">
                    Your score
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-lo)]">
                    Score their contribution from 1 (limited impact) to 10
                    (exceptional impact).
                  </p>
                  <div className="mt-3 grid grid-cols-5 gap-2">
                    {Array.from({ length: 10 }, (_, index) => index + 1).map(
                      (value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setScore(value)}
                          className={`h-10 rounded-xl border text-sm font-bold transition-colors ${score === value ? "border-brand-500 bg-brand-500 text-white" : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-hi)] hover:border-brand-500/50"}`}
                        >
                          {value}
                        </button>
                      ),
                    )}
                  </div>
                </div>
                {votingStage === "management" && (
                  <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                    This finalist was selected from the team vote. Your score
                    will determine the winner.
                  </p>
                )}
                <Button
                  className="w-full"
                  icon="solar:star-fall-broken"
                  loading={saving}
                  disabled={score === null}
                  onClick={submitVote}
                >
                  Save {votingStage === "team" ? "team" : "management"} score
                </Button>
              </>
            )}
          </div>
        )}
      </SlideOver>

      <SimpleModal
        open={newCycleOpen}
        onClose={() => setNewCycleOpen(false)}
        title="Open Wall of Fame nominations"
        icon="solar:cup-star-broken"
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-[var(--text-lo)]">
            Open a monthly cycle for staff nominations.
          </p>
          <label className="block text-xs font-semibold text-[var(--text-hi)]">
            Award month
            <div className="mt-1.5">
              <MonthSelect value={month} onChange={setMonth} />
            </div>
          </label>
          <div className="block text-xs font-semibold text-[var(--text-hi)]">
            Nomination window
            <div className="mt-1.5">
              <DateRangePicker
                value={nominationWindow}
                onChange={(range) => {
                  setOpensAt(
                    range.startDate ? toDateString(range.startDate) : "",
                  );
                  setClosesAt(range.endDate ? toDateString(range.endDate) : "");
                }}
                allowedRanges={["Custom Range"]}
                maxDate={null}
                fullWidth
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <Button variant="secondary" onClick={() => setNewCycleOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={saving}
              disabled={!!(opensAt && closesAt && closesAt < opensAt)}
              onClick={createCycle}
            >
              Open nominations
            </Button>
          </div>
        </div>
      </SimpleModal>
    </div>
  );
}
