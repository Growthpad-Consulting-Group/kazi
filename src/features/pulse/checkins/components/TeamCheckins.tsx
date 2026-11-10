"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/Button";
import StatCard from "@/components/ui/StatCard";
import { Accordion } from "@/components/ui/Accordion";
import type { CheckinWithUser, DailyWeekSummary } from "../actions";

interface Props {
  checkins: CheckinWithUser[];
  weekStart: string;
  dailySummary?: {
    staffLogged: number;
    daysLogged: number;
    totalMinutes: number;
    byUser: Record<string, DailyWeekSummary>;
    staff: { id: string; name: string }[];
  };
  organisationWide?: boolean;
}

const MOODS = ["😔", "😕", "😐", "🙂", "😄"];

function weekRangeLabel(weekStart: string) {
  const start = new Date(`${weekStart}T12:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 4);
  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString("en-KE", {
    day: "numeric",
    ...(sameMonth ? {} : { month: "short" }),
  });
  const endLabel = end.toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  return `${startLabel}–${endLabel}${sameYear ? ` ${end.getFullYear()}` : ""}`;
}

function hasMoodAlert(
  checkins: CheckinWithUser[],
  userId: string,
  weekStart: string,
) {
  return checkins.some(
    (c) =>
      c.user_id === userId && c.week_start === weekStart && (c.mood ?? 3) <= 2,
  );
}

function hasBlockerAlert(
  checkins: CheckinWithUser[],
  userId: string,
  weekStart: string,
) {
  const recent = checkins
    .filter((c) => c.user_id === userId)
    .sort((a, b) => b.week_start.localeCompare(a.week_start))
    .slice(0, 3);
  return (
    recent[0]?.week_start === weekStart &&
    Boolean(recent[0]?.blockers?.trim()) &&
    recent.filter((c) => c.blockers?.trim()).length >= 2
  );
}

function formatMinutes(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours && minutes
    ? `${hours}h ${minutes}m`
    : hours
      ? `${hours}h`
      : `${minutes}m`;
}

export function TeamCheckins({
  checkins,
  weekStart,
  dailySummary,
  organisationWide = false,
}: Props) {
  const router = useRouter();
  const availableWeeks = Array.from(
    new Set([weekStart, ...checkins.map((checkin) => checkin.week_start)]),
  ).sort((a, b) => b.localeCompare(a));
  const [selectedWeekStart, setSelectedWeekStart] = useState(weekStart);
  const selectedWeekIndex = availableWeeks.indexOf(selectedWeekStart);
  const thisWeek = checkins.filter(
    (checkin) => checkin.week_start === selectedWeekStart,
  );

  const [expanded, setExpanded] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summarising, setSummarising] = useState(false);
  const [filter, setFilter] = useState<
    "all" | "review" | "attention" | "reviewed"
  >("all");

  const awaitingReview = thisWeek.filter((c) => c.status !== "reviewed").length;
  const lowMood = thisWeek.filter((c) =>
    hasMoodAlert(checkins, c.user_id, selectedWeekStart),
  ).length;
  const repeatedBlockers = thisWeek.filter((c) =>
    hasBlockerAlert(checkins, c.user_id, selectedWeekStart),
  ).length;
  const visibleCheckins = thisWeek.filter((checkin) => {
    if (filter === "review") return checkin.status !== "reviewed";
    if (filter === "attention")
      return (
        hasMoodAlert(checkins, checkin.user_id, selectedWeekStart) ||
        hasBlockerAlert(checkins, checkin.user_id, selectedWeekStart)
      );
    if (filter === "reviewed") return checkin.status === "reviewed";
    return true;
  });
  const dailySummaryText = (() => {
    if (!dailySummary) return "";
    const dayLabel = `${dailySummary.daysLogged} day${dailySummary.daysLogged === 1 ? "" : "s"}`;
    if (organisationWide)
      return `${dailySummary.staffLogged} staff logged work across ${dayLabel}.`;
    if (dailySummary.staffLogged === 1) {
      const [staffId] = Object.keys(dailySummary.byUser);
      const staffName = dailySummary.staff.find(
        (staff) => staff.id === staffId,
      )?.name;
      return staffName
        ? `${staffName} logged work on ${dailySummary.daysLogged} of 5 workdays this week.`
        : `1 direct report logged work across ${dayLabel}.`;
    }
    return `${dailySummary.staffLogged} of ${dailySummary.staff.length} direct reports logged work across ${dayLabel}.`;
  })();

  async function generateSummary() {
    setSummarising(true);
    try {
      const res = await fetch("/api/pulse/ai-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: selectedWeekStart }),
      });
      const data = (await res.json().catch(() => null)) as {
        summary?: string;
      } | null;
      if (data?.summary) setAiSummary(data.summary);
    } finally {
      setSummarising(false);
    }
  }

  const activeAiSummary =
    aiSummary ??
    thisWeek.find((checkin) => checkin.ai_summary)?.ai_summary ??
    null;
  function selectWeek(nextWeek: string) {
    setSelectedWeekStart(nextWeek);
    setExpanded(null);
    setComment("");
    setAiSummary(null);
    setFilter("all");
  }

  async function submitReview(checkinId: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/pulse/checkins/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkinId, comment }),
      });
      if (!res.ok) throw new Error();
      setExpanded(null);
      setComment("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6">
        <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                <Icon
                  icon="solar:users-group-two-rounded-broken"
                  className="h-5 w-5"
                />
              </span>
              <div>
                <h2 className="font-semibold text-[var(--text-hi)]">
                  Team review desk
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-lo)]">
                  Review updates, acknowledge blockers, and keep the week
                  moving.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-sm">
              <button
                type="button"
                aria-label="Previous check-in week"
                disabled={selectedWeekIndex >= availableWeeks.length - 1}
                onClick={() =>
                  selectWeek(availableWeeks[selectedWeekIndex + 1])
                }
                className="rounded-lg p-1.5 text-[var(--text-lo)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-hi)] disabled:cursor-not-allowed disabled:opacity-35"
              >
                <Icon icon="solar:alt-arrow-left-broken" className="h-4 w-4" />
              </button>
              <select
                value={selectedWeekStart}
                onChange={(event) => selectWeek(event.target.value)}
                aria-label="Select check-in week"
                className="max-w-44 appearance-none bg-transparent px-1 text-xs font-semibold text-[var(--text-hi)] outline-none sm:max-w-none"
              >
                {availableWeeks.map((item) => (
                  <option key={item} value={item}>
                    {item === weekStart
                      ? `This week · ${weekRangeLabel(item)}`
                      : weekRangeLabel(item)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-label="Next check-in week"
                disabled={selectedWeekIndex <= 0}
                onClick={() =>
                  selectWeek(availableWeeks[selectedWeekIndex - 1])
                }
                className="rounded-lg p-1.5 text-[var(--text-lo)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-hi)] disabled:cursor-not-allowed disabled:opacity-35"
              >
                <Icon icon="solar:alt-arrow-right-broken" className="h-4 w-4" />
              </button>
            </div>
            {thisWeek.length > 0 && (
              <Button
                size="sm"
                variant="primary"
                icon="solar:magic-stick-3-broken"
                loading={summarising}
                onClick={generateSummary}
              >
                {summarising ? "Summarising…" : "Team summary"}
              </Button>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          title="Submitted"
          value={thisWeek.length}
          icon="solar:clipboard-check-broken"
          color="blue"
          variant="inline"
          compact
          onClick={() => setFilter("all")}
        />
        <StatCard
          title="To review"
          value={awaitingReview}
          icon="solar:eye-broken"
          color={awaitingReview ? "amber" : "green"}
          variant="inline"
          compact
          onClick={() => setFilter("review")}
        />
        <StatCard
          title="Low mood"
          value={lowMood}
          icon="solar:heart-pulse-broken"
          color={lowMood ? "red" : "green"}
          variant="inline"
          compact
          onClick={() => setFilter("attention")}
        />
        <StatCard
          title="Repeat blockers"
          value={repeatedBlockers}
          icon="solar:danger-triangle-broken"
          color={repeatedBlockers ? "orange" : "green"}
          variant="inline"
          compact
          onClick={() => setFilter("attention")}
        />
      </div>

      {selectedWeekStart === weekStart &&
        dailySummary &&
        dailySummary.daysLogged > 0 && (
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand-500/15 bg-brand-500/[0.045] px-5 py-4 shadow-xl shadow-slate-200/40 dark:shadow-black/20">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                <Icon icon="solar:notebook-broken" className="h-4.5 w-4.5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--text-hi)]">
                  Daily reporting this week
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-lo)]">
                  {dailySummaryText}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-xl bg-[var(--surface)] px-3 py-2 font-mono text-sm font-bold text-brand-500">
                {formatMinutes(dailySummary.totalMinutes)}
              </span>
              <Button
                size="sm"
                variant="secondary"
                icon="solar:arrow-right-broken"
                onClick={() =>
                  router.push("/pulse/checkins?tab=team&teamView=activity")
                }
              >
                View activity
              </Button>
            </div>
          </section>
        )}

      {activeAiSummary && (
        <section className="rounded-2xl border border-blue-500/15 bg-blue-500/5 p-4 shadow-xl shadow-slate-200/40 dark:shadow-black/20">
          <div className="flex gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <Icon icon="solar:magic-stick-3-broken" className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-semibold text-blue-600">
                AI team summary
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-hi)]">
                {activeAiSummary}
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-[var(--text-hi)]">
              Submitted updates
            </h2>
            <p className="mt-1 text-sm text-[var(--text-lo)]">
              Open an update to review progress and leave a manager note.
            </p>
          </div>
          <div className="flex flex-wrap gap-1 rounded-xl bg-[var(--surface-2)] p-1">
            {(
              [
                ["all", "All"],
                ["review", "To review"],
                ["attention", "Needs support"],
                ["reviewed", "Reviewed"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${filter === value ? "bg-[var(--surface)] text-brand-500 shadow-sm" : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {thisWeek.length ? (
          <div className="divide-y divide-[var(--border)]">
            {visibleCheckins.map((checkin) => {
              const isExpanded = expanded === checkin.id;
              const moodAlert = hasMoodAlert(
                checkins,
                checkin.user_id,
                selectedWeekStart,
              );
              const blockerAlert = hasBlockerAlert(
                checkins,
                checkin.user_id,
                selectedWeekStart,
              );

              return (
                <div key={checkin.id}>
                  {/* Row */}
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 bg-[var(--surface)] px-4 py-3.5 text-left transition-colors hover:bg-[var(--surface-2)]"
                    onClick={() => {
                      setExpanded(isExpanded ? null : checkin.id);
                      setComment("");
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-xs font-bold text-brand-500">
                        {checkin.users?.name?.slice(0, 1).toUpperCase() ?? "?"}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[var(--text-hi)]">
                          {checkin.users?.name ?? "Unknown teammate"}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-[var(--text-lo)]">
                          {checkin.users?.job_title ??
                            checkin.users?.department ??
                            "Team member"}
                        </span>
                      </span>
                    </div>
                    <span className="flex shrink-0 items-center gap-2">
                      {checkin.mood && (
                        <span
                          className="text-base"
                          title={`Mood: ${checkin.mood}/5`}
                        >
                          {MOODS[checkin.mood - 1]}
                        </span>
                      )}
                      {moodAlert && (
                        <AlertChip
                          icon="solar:heart-pulse-broken"
                          label="Mood"
                          tone="red"
                        />
                      )}
                      {blockerAlert && (
                        <AlertChip
                          icon="solar:danger-triangle-broken"
                          label="Blocker"
                          tone="amber"
                        />
                      )}
                      <StatusChip status={checkin.status} />
                      <Icon
                        icon={
                          isExpanded
                            ? "solar:alt-arrow-up-broken"
                            : "solar:alt-arrow-down-broken"
                        }
                        className="h-4 w-4 text-[var(--text-lo)]"
                      />
                    </span>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-[var(--border)] bg-[var(--surface-2)] p-4 sm:p-5">
                      <div className="grid gap-3 md:grid-cols-3">
                        <ReadSection
                          label="Wins"
                          icon="solar:cup-star-broken"
                          value={checkin.wins}
                        />
                        <ReadSection
                          label="Priorities"
                          icon="solar:target-broken"
                          value={checkin.priorities}
                        />
                        <ReadSection
                          label="Blockers"
                          icon="solar:danger-triangle-broken"
                          value={checkin.blockers}
                        />
                      </div>
                      {dailySummary?.byUser[checkin.user_id] && (
                        <DailyWorkBreakdown
                          summary={dailySummary.byUser[checkin.user_id]}
                        />
                      )}

                      {checkin.ai_summary && (
                        <div className="mt-3 rounded-xl border border-blue-500/15 bg-blue-500/5 p-3">
                          <p className="text-xs font-semibold text-blue-600">
                            AI summary
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-[var(--text-hi)]">
                            {checkin.ai_summary}
                          </p>
                        </div>
                      )}

                      {checkin.status !== "reviewed" ? (
                        <div className="mt-4 border-t border-[var(--border)] pt-4">
                          <label className="text-xs font-semibold text-[var(--text-hi)]">
                            Manager note{" "}
                            <span className="font-normal text-[var(--text-lo)]">
                              Optional
                            </span>
                          </label>
                          <textarea
                            rows={2}
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Acknowledge progress or offer support…"
                            className="mt-2 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-hi)] outline-none placeholder:text-[var(--text-lo)] focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10"
                          />
                          <div className="mt-3 flex justify-end">
                            <Button
                              size="sm"
                              icon="solar:check-circle-broken"
                              loading={saving}
                              disabled={saving}
                              onClick={() => submitReview(checkin.id)}
                            >
                              Mark reviewed
                            </Button>
                          </div>
                        </div>
                      ) : (
                        checkin.manager_comment && (
                          <div className="mt-4 rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-3">
                            <p className="text-xs font-semibold text-emerald-600">
                              Your feedback
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-hi)]">
                              {checkin.manager_comment}
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="m-5 flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-4 text-center">
            <Icon
              icon="solar:clipboard-check-broken"
              className="h-6 w-6 text-[var(--text-lo)]"
            />
            <p className="mt-2 text-sm font-medium text-[var(--text-hi)]">
              No direct-report updates yet
            </p>
            <p className="mt-1 text-xs text-[var(--text-lo)]">
              Submitted updates from staff assigned to you will appear here for
              review.
            </p>
          </div>
        )}
        {thisWeek.length > 0 && visibleCheckins.length === 0 && (
          <div className="m-5 rounded-xl border border-dashed border-[var(--border)] px-4 py-10 text-center">
            <Icon
              icon="solar:filter-broken"
              className="mx-auto h-5 w-5 text-[var(--text-lo)]"
            />
            <p className="mt-2 text-sm font-semibold text-[var(--text-hi)]">
              No updates in this view
            </p>
            <button
              type="button"
              onClick={() => setFilter("all")}
              className="mt-2 text-xs font-semibold text-brand-500 hover:underline"
            >
              Show all updates
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function AlertChip({
  icon,
  label,
  tone,
}: {
  icon: string;
  label: string;
  tone: "red" | "amber";
}) {
  return (
    <span
      className={`hidden items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold sm:inline-flex ${
        tone === "red"
          ? "bg-red-500/10 text-red-500"
          : "bg-amber-500/10 text-amber-600"
      }`}
    >
      <Icon icon={icon} className="h-3 w-3" />
      {label}
    </span>
  );
}

function StatusChip({ status }: { status: string }) {
  const tones: Record<string, string> = {
    draft: "bg-amber-500/10 text-amber-600",
    submitted: "bg-blue-500/10 text-blue-600",
    reviewed: "bg-emerald-500/10 text-emerald-600",
  };
  return (
    <span
      className={`hidden rounded-md px-1.5 py-1 text-[10px] font-semibold capitalize sm:inline-flex ${
        tones[status] ?? "bg-[var(--surface-2)] text-[var(--text-lo)]"
      }`}
    >
      {status}
    </span>
  );
}

function ReadSection({
  label,
  icon,
  value,
}: {
  label: string;
  icon: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex items-center gap-1.5">
        <Icon icon={icon} className="h-3.5 w-3.5 text-brand-500" />
        <p className="text-xs font-semibold text-[var(--text-hi)]">{label}</p>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-lo)]">
        {value || "Not filled in"}
      </p>
    </div>
  );
}

function DailyWorkBreakdown({ summary }: { summary: DailyWeekSummary }) {
  const days = [...summary.days].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <section className="mt-3 rounded-xl border border-brand-500/15 bg-brand-500/[0.04] p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-hi)]">
          <Icon
            icon="solar:notebook-broken"
            className="h-4 w-4 text-brand-500"
          />
          Daily activity evidence
        </span>
        <span className="font-mono text-xs font-bold text-brand-500">
          {summary.daysLogged}/5 · {formatMinutes(summary.totalMinutes)}
        </span>
      </div>
      <div className="mt-3 max-h-[32rem] space-y-2 overflow-y-auto pr-1">
        {days.map((day, dayIndex) => (
          <Accordion
            key={day.date}
            title={new Date(`${day.date}T12:00:00`).toLocaleDateString(
              "en-KE",
              { weekday: "long", day: "numeric", month: "short" },
            )}
            subtitle={`${day.entries.length} logged task${day.entries.length === 1 ? "" : "s"}`}
            icon="solar:calendar-broken"
            badge={formatMinutes(
              day.entries.reduce((total, entry) => total + entry.minutes, 0),
            )}
            defaultOpen={dayIndex === days.length - 1}
            className="transition-colors hover:border-brand-500/40"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_6rem_5rem_3.5rem] gap-2 px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-lo)]">
              <span>Task</span>
              <span>Client</span>
              <span>Type</span>
              <span className="text-right">Time</span>
            </div>
            {day.entries.map((entry, index) => (
              <div
                key={`${entry.task}-${index}`}
                className="grid grid-cols-[minmax(0,1fr)_6rem_5rem_3.5rem] items-center gap-2 rounded-lg border-b border-[var(--border)] px-2 py-2 text-sm transition-colors last:border-0 hover:bg-brand-500/[0.06]"
              >
                <span className="truncate text-[var(--text-hi)]">
                  {entry.task}
                </span>
                <span className="truncate text-[var(--text-lo)]">
                  {entry.client || "—"}
                </span>
                <span className="truncate text-[var(--text-lo)]">
                  {entry.category}
                </span>
                <span className="text-right font-mono text-[var(--text-lo)]">
                  {formatMinutes(entry.minutes)}
                </span>
              </div>
            ))}
          </Accordion>
        ))}
      </div>
    </section>
  );
}
