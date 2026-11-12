"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { wallOfFameChannelName } from "@/lib/wall-of-fame-channel";
import Image from "next/image";
import { Avatar } from "@/components/ui/Avatar";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { type DateRangeValue } from "@/components/ui/DateRangePicker";
import StatCard from "@/components/ui/StatCard";
import { WallOfFameCategory } from "@/lib/wall-of-fame-category-rules";
import WallOfFameWinners from "./WallOfFameWinners";
import WallOfFameNominationPanel from "./WallOfFameNominationPanel";
import {
  WallOfFameNewCycleModal,
  WallOfFameScheduleModal,
} from "./WallOfFameScheduleModals";
import {
  type Cycle,
  type Nomination,
  type Staff,
  type Vote,
  type Winner,
  monthLabel,
  nominationCountdown,
  nominationWindowLabel,
  recommendedCycleSchedule,
} from "./wall-of-fame-model";

export default function WallOfFameClient({
  currentUserId,
  canManage,
  canTeamVote,
  requiresMonthlyEntry,
  cycle,
  staff,
  nominations,
  votes,
  winners,
  categories,
}: {
  currentUserId: string;
  canManage: boolean;
  canTeamVote: boolean;
  requiresMonthlyEntry: boolean;
  cycle: Cycle;
  staff: Staff[];
  nominations: Nomination[];
  votes: Vote[];
  winners: Winner[];
  categories: WallOfFameCategory[];
}) {
  const router = useRouter();
  // The option shape the category UI was written against, now built from the stored categories.
  const CATEGORY_OPTIONS = useMemo(
    () =>
      categories.map((item) => ({
        value: item.key,
        label: item.label,
        description: item.description,
        purpose: item.purpose,
        criteria: item.criteria,
        icon: item.icon,
      })),
    [categories],
  );
  const firstCategory = categories[0]?.key ?? "";
  const categoryLabel = (key: string) =>
    categories.find((item) => item.key === key)?.label ?? key;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [impact, setImpact] = useState("");
  const [category, setCategory] = useState<string>(firstCategory);
  const [score, setScore] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [newCycleOpen, setNewCycleOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [month, setMonth] = useState(
    `${new Date().toISOString().slice(0, 7)}-01`,
  );
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [teamVotingOpensAt, setTeamVotingOpensAt] = useState("");
  const [teamVotingClosesAt, setTeamVotingClosesAt] = useState("");
  const [managementVotingOpensAt, setManagementVotingOpensAt] = useState("");
  const [managementVotingClosesAt, setManagementVotingClosesAt] = useState("");
  const [currentTime, setCurrentTime] = useState(() => new Date().getTime());
  const nominationWindow: DateRangeValue = {
    startDate: opensAt ? new Date(`${opensAt}T00:00:00`) : null,
    endDate: closesAt ? new Date(`${closesAt}T00:00:00`) : null,
  };
  const teamVotingWindow: DateRangeValue = {
    startDate: teamVotingOpensAt
      ? new Date(`${teamVotingOpensAt}T00:00:00`)
      : null,
    endDate: teamVotingClosesAt
      ? new Date(`${teamVotingClosesAt}T00:00:00`)
      : null,
  };
  const managementVotingWindow: DateRangeValue = {
    startDate: managementVotingOpensAt
      ? new Date(`${managementVotingOpensAt}T00:00:00`)
      : null,
    endDate: managementVotingClosesAt
      ? new Date(`${managementVotingClosesAt}T00:00:00`)
      : null,
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
  const isSelfNomination = selected?.id === currentUserId;
  const selectedNominations = selected
    ? (nominationsByNominee[selected.id] ?? [])
    : [];
  const nomineeCount = Object.keys(nominationsByNominee).length;
  const yourNominationEntries = nominations.filter(
    (item) => item.nominator_id === currentUserId,
  );
  const yourNominations = yourNominationEntries.length;
  const hasMonthlyEntry = nominations.some(
    (item) =>
      item.nominator_id === currentUserId && item.nominee_id === currentUserId,
  );
  const isOpen = cycle?.status === "open";
  const activeNominationWindowLabel = cycle
    ? nominationWindowLabel(cycle)
    : null;
  const activeNominationCountdown = cycle ? nominationCountdown(cycle) : null;
  const stageCloseAt =
    cycle?.status === "team_voting"
      ? cycle.team_voting_closes_at
      : cycle?.status === "management_voting"
        ? cycle.management_voting_closes_at
        : null;
  const stageOpenAt =
    cycle?.status === "team_voting"
      ? cycle.team_voting_opens_at
      : cycle?.status === "management_voting"
        ? cycle.management_voting_opens_at
        : null;
  const votingWindowStarted =
    !stageOpenAt ||
    new Date(`${stageOpenAt}T00:00:00`).getTime() <= currentTime;
  const votingWindowOpen =
    votingWindowStarted &&
    (!stageCloseAt ||
      new Date(`${stageCloseAt}T23:59:59`).getTime() >= currentTime);
  const votingStage =
    cycle?.status === "team_voting" && canTeamVote && votingWindowOpen
      ? "team"
      : cycle?.status === "management_voting" && canManage && votingWindowOpen
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
  }, [votes, CATEGORY_OPTIONS]);
  const finalistsByCategory = useMemo(() => {
    const byCategory = new Map<string, Set<string>>();
    if (cycle?.status !== "management_voting") return byCategory;
    for (const option of CATEGORY_OPTIONS) {
      const ids = [...voteAverages.entries()]
        .filter(([key]) => key.startsWith(`${option.value}:`))
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([key]) => key.slice(option.value.length + 1));
      byCategory.set(option.value, new Set(ids));
    }
    return byCategory;
  }, [cycle?.status, voteAverages, CATEGORY_OPTIONS]);

  const votingDirectory = useMemo(() => {
    if (!isVoting) return directory;
    return directory.filter((member) => {
      const nomineeCategories = new Set(
        (nominationsByNominee[member.id] ?? []).map((item) => item.category),
      );
      if (votingStage === "team") return nomineeCategories.size > 0;
      return [...nomineeCategories].some((value) =>
        finalistsByCategory.get(value)?.has(member.id),
      );
    });
  }, [
    directory,
    finalistsByCategory,
    isVoting,
    nominationsByNominee,
    votingStage,
  ]);

  const openNominate = (id: string) => {
    setSelectedId(id);
    setImpact("");
    const nominatedCategories = (nominationsByNominee[id] ?? []).map(
      (item) => item.category,
    );
    setCategory(nominatedCategories[0] ?? firstCategory);
    setScore(null);
  };

  const nominate = async () => {
    if (!cycle || !selected || impact.trim().length < 20) return;
    setSaving(true);
    try {
      const response = await fetch("/api/pulse/wall-of-fame/nominations", {
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
      toast.success(
        isSelfNomination
          ? "Your monthly project entry has been submitted."
          : `Nominated ${selected.name}.`,
      );
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
      const response = await fetch("/api/pulse/wall-of-fame/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          opensAt: opensAt || null,
          closesAt: closesAt || null,
          teamVotingOpensAt: teamVotingOpensAt || null,
          teamVotingClosesAt: teamVotingClosesAt || null,
          managementVotingOpensAt: managementVotingOpensAt || null,
          managementVotingClosesAt: managementVotingClosesAt || null,
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

  const openNewCycleModal = () => {
    const schedule = recommendedCycleSchedule(month);
    setOpensAt(schedule.opensAt);
    setClosesAt(schedule.closesAt);
    setTeamVotingOpensAt(schedule.teamVotingOpensAt);
    setTeamVotingClosesAt(schedule.teamVotingClosesAt);
    setManagementVotingOpensAt(schedule.managementVotingOpensAt);
    setManagementVotingClosesAt(schedule.managementVotingClosesAt);
    setNewCycleOpen(true);
  };

  const openScheduleModal = () => {
    if (!cycle) return;
    setOpensAt(cycle.opens_at ?? "");
    setClosesAt(cycle.closes_at ?? "");
    setTeamVotingOpensAt(cycle.team_voting_opens_at ?? "");
    setTeamVotingClosesAt(cycle.team_voting_closes_at ?? "");
    setManagementVotingOpensAt(cycle.management_voting_opens_at ?? "");
    setManagementVotingClosesAt(cycle.management_voting_closes_at ?? "");
    setScheduleOpen(true);
  };

  const saveSchedule = async () => {
    if (!cycle) return;
    setSaving(true);
    try {
      const response = await fetch("/api/pulse/wall-of-fame/cycles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: cycle.id,
          opensAt: opensAt || null,
          closesAt: closesAt || null,
          teamVotingOpensAt: teamVotingOpensAt || null,
          teamVotingClosesAt: teamVotingClosesAt || null,
          managementVotingOpensAt: managementVotingOpensAt || null,
          managementVotingClosesAt: managementVotingClosesAt || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success("Award schedule updated.");
      setScheduleOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update the schedule.",
      );
    } finally {
      setSaving(false);
    }
  };

  const closeCycle = async () => {
    if (!cycle) return;
    setSaving(true);
    try {
      const response = await fetch("/api/pulse/wall-of-fame/cycles", {
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
      const response = await fetch("/api/pulse/wall-of-fame/cycles", {
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
      const response = await fetch("/api/pulse/wall-of-fame/votes", {
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

  const savePublicHighlight = async (nominationId: string, value: string) => {
    setSaving(true);
    try {
      const response = await fetch(
        `/api/pulse/wall-of-fame/nominations/${nominationId}/highlight`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicHighlight: value }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success(
        value.trim()
          ? "Public voting highlight saved."
          : "Public voting highlight removed.",
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save the public highlight.",
      );
    } finally {
      setSaving(false);
    }
  };

  const publishWinners = async () => {
    if (!cycle) return;
    setSaving(true);
    try {
      const response = await fetch("/api/pulse/wall-of-fame/winners", {
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
      const response = await fetch("/api/pulse/wall-of-fame/winners", {
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
    const timer = window.setInterval(
      () => setCurrentTime(new Date().getTime()),
      60_000,
    );
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!cycle) return;
    const channel = supabaseBrowser
      .channel(wallOfFameChannelName(cycle.id))
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
                    ? votingWindowOpen
                      ? "Team voting open"
                      : votingWindowStarted
                        ? "Team voting closed"
                        : "Team voting scheduled"
                    : cycle.status === "management_voting"
                      ? "Management voting"
                      : cycle.status === "published"
                        ? "Winners published"
                        : "Nominations closed"
                : "Nominations not open yet"}
              {((isOpen && activeNominationCountdown) ||
                (!isOpen && stageCloseAt)) && (
                <span
                  className={
                    (
                      isOpen
                        ? activeNominationCountdown?.urgent
                        : new Date(`${stageCloseAt}T23:59:59`).getTime() -
                            currentTime <=
                          3 * 86_400_000
                    )
                      ? "text-amber-600 dark:text-amber-300"
                      : ""
                  }
                >
                  ·{" "}
                  {isOpen
                    ? activeNominationCountdown?.label
                    : votingWindowOpen
                      ? `${Math.max(0, Math.ceil((new Date(`${stageCloseAt}T23:59:59`).getTime() - currentTime) / 86_400_000))} days remaining`
                      : "Voting closed"}
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
                {cycle?.status !== "published" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon="solar:calendar-mark-broken"
                    onClick={openScheduleModal}
                  >
                    Edit schedule
                  </Button>
                )}
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
                    onClick={openNewCycleModal}
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

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-brand-500">Award guide</p>
            <h2 className="mt-1 text-base font-semibold text-[var(--text-hi)]">
              Celebrate the impact that stood out.
            </h2>
          </div>
          <p className="max-w-md text-xs leading-relaxed text-[var(--text-lo)]">
            Match the award to the impact, then make the nomination specific.
          </p>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {CATEGORY_OPTIONS.map((option) => (
            <article
              key={option.value}
              className={`overflow-hidden rounded-xl border bg-[var(--surface-2)] transition-shadow duration-200 hover:shadow-lg ${option.value === firstCategory ? "border-brand-500/25" : "border-blue-500/20"}`}
            >
              <div className="flex gap-3 p-4">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${option.value === firstCategory ? "bg-brand-500 text-white" : "bg-blue-500/10 text-blue-600 dark:text-blue-300"}`}
                >
                  <Icon icon={option.icon} className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[var(--text-hi)]">
                    {option.label}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--text-lo)]">
                    {option.description}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--text-hi)]">
                    {option.purpose}
                  </p>
                </div>
              </div>
              <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-lo)]">
                  Strong nominations show
                </p>
                <ul className="mt-2 grid gap-1.5 sm:grid-cols-3">
                  {option.criteria.map((criterion) => (
                    <li
                      key={criterion}
                      className="flex items-start gap-1.5 text-xs leading-snug text-[var(--text-lo)]"
                    >
                      <Icon
                        icon="solar:check-circle-broken"
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500"
                      />
                      {criterion}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
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

      {yourNominationEntries.length > 0 && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-brand-500">
                Your entries
              </p>
              <h2 className="mt-1 text-base font-semibold text-[var(--text-hi)]">
                Nominations you submitted this cycle
              </h2>
            </div>
            <span className="rounded-lg bg-brand-500/10 px-2.5 py-1 font-mono text-xs font-semibold text-brand-500">
              {yourNominationEntries.length}
            </span>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {yourNominationEntries.map((entry) => {
              const nominee = staff.find(
                (member) => member.id === entry.nominee_id,
              );
              return (
                <article
                  key={entry.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5 transition-colors hover:border-brand-500/25"
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={nominee?.name ?? "Team member"}
                      src={nominee?.avatar_url}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--text-hi)]">
                        {nominee?.name ?? "Team member"}
                      </p>
                      <p className="truncate text-xs text-[var(--text-lo)]">
                        {nominee?.job_title ?? "Wall of Fame nomination"}
                      </p>
                    </div>
                    <span className="rounded-md bg-brand-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-brand-500">
                      {categoryLabel(entry.category)}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-[var(--text-lo)]">
                    {entry.impact_statement}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {isVoting && votingStage === "team" && (
        <section className="flex flex-col gap-3 rounded-2xl border border-brand-500/20 bg-brand-500/[0.06] p-4 shadow-lg shadow-brand-500/5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-hi)]">
              Vote for this month’s standout work
            </p>
            <p className="mt-1 text-xs text-[var(--text-lo)]">
              Choose one eligible nominee in each award and score their impact
              from 1 to 10.
            </p>
          </div>
          <span className="rounded-lg bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text-hi)]">
            {
              votes.filter(
                (vote) =>
                  vote.voter_id === currentUserId && vote.stage === "team",
              ).length
            }{" "}
            of 2 awards scored
          </span>
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
                    ? "Only nominated colleagues are shown. Select one nominee per award and score their impact."
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
        {votingDirectory.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-[var(--text-lo)]">
            No staff match your search.
          </div>
        ) : (
          <div className="grid max-h-[72vh] grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-3 sm:gap-4 sm:p-5 lg:grid-cols-4 xl:grid-cols-5">
            {votingDirectory.map((member) => {
              const received = nominationsByNominee[member.id] ?? [];
              const receivedCounts = categories
                .map((item) => ({
                  key: item.key,
                  label: item.label,
                  count: received.filter((entry) => entry.category === item.key)
                    .length,
                }))
                .filter((item) => item.count > 0);
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
                  {receivedCounts.length > 0 && (
                    <div className="absolute right-2.5 top-2.5 flex flex-col items-end gap-1">
                      {receivedCounts.map((item) => (
                        <span
                          key={item.key}
                          className={
                            item.key === firstCategory
                              ? "rounded-lg bg-brand-500 px-2 py-0.5 font-mono text-[10px] font-bold text-white shadow-lg"
                              : "rounded-lg bg-white/90 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-900 shadow-lg"
                          }
                        >
                          {item.label} × {item.count}
                        </span>
                      ))}
                    </div>
                  )}
                  {isWinner && (
                    <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-lg bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950 shadow-lg">
                      <Icon icon="solar:cup-star-broken" className="h-3 w-3" />
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

      <WallOfFameWinners
        categories={categories}
        winners={winners}
        staff={staff}
        canManage={canManage}
        saving={saving}
        onUpdatePrizeStatus={updatePrizeStatus}
      />

      <WallOfFameNominationPanel
        categoryOptions={CATEGORY_OPTIONS}
        canManage={canManage}
        category={category}
        categoryLabel={categoryLabel}
        currentUserId={currentUserId}
        cycle={cycle}
        finalistsByCategory={finalistsByCategory}
        impact={impact}
        isOpen={isOpen}
        isSelfNomination={isSelfNomination}
        isVoting={isVoting}
        month={month}
        nominate={nominate}
        saving={saving}
        score={score}
        selected={selected}
        selectedNominations={selectedNominations}
        setCategory={setCategory}
        setImpact={setImpact}
        setScore={setScore}
        setSelectedId={setSelectedId}
        savePublicHighlight={savePublicHighlight}
        submitVote={submitVote}
        votingStage={votingStage}
      />

      <WallOfFameScheduleModal
        managementVotingWindow={managementVotingWindow}
        nominationWindow={nominationWindow}
        teamVotingWindow={teamVotingWindow}
        saveSchedule={saveSchedule}
        saving={saving}
        scheduleOpen={scheduleOpen}
        setScheduleOpen={setScheduleOpen}
        setClosesAt={setClosesAt}
        setManagementVotingClosesAt={setManagementVotingClosesAt}
        setManagementVotingOpensAt={setManagementVotingOpensAt}
        setOpensAt={setOpensAt}
        setTeamVotingClosesAt={setTeamVotingClosesAt}
        setTeamVotingOpensAt={setTeamVotingOpensAt}
      />

      <WallOfFameNewCycleModal
        closesAt={closesAt}
        cycle={cycle}
        createCycle={createCycle}
        managementVotingClosesAt={managementVotingClosesAt}
        managementVotingOpensAt={managementVotingOpensAt}
        managementVotingWindow={managementVotingWindow}
        month={month}
        newCycleOpen={newCycleOpen}
        nominationWindow={nominationWindow}
        nominations={nominations}
        opensAt={opensAt}
        saving={saving}
        setClosesAt={setClosesAt}
        setManagementVotingClosesAt={setManagementVotingClosesAt}
        setManagementVotingOpensAt={setManagementVotingOpensAt}
        setMonth={setMonth}
        setNewCycleOpen={setNewCycleOpen}
        setOpensAt={setOpensAt}
        setTeamVotingClosesAt={setTeamVotingClosesAt}
        setTeamVotingOpensAt={setTeamVotingOpensAt}
        staff={staff}
        teamVotingClosesAt={teamVotingClosesAt}
        teamVotingOpensAt={teamVotingOpensAt}
        teamVotingWindow={teamVotingWindow}
      />
    </div>
  );
}
