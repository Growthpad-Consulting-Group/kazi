"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import type { Checkin } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { PlainTextEditor } from "@/components/ui/PlainTextEditor";
import { Accordion } from "@/components/ui/Accordion";
import type { DailyWeekNote, DailyWeekSummary } from "../actions";

interface Props {
  userId: string;
  weekStart: string;
  existing: Checkin | null;
  dailySummary?: DailyWeekSummary;
}

const MOODS = [
  { value: 1, emoji: "😔", label: "Struggling" },
  { value: 2, emoji: "😕", label: "Low" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😄", label: "Great" },
];

function formatMinutes(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours && minutes
    ? `${hours}h ${minutes}m`
    : hours
      ? `${hours}h`
      : `${minutes}m`;
}

function dailyNotesToWeeklyText(notes: DailyWeekNote[]) {
  return notes
    .map((note) => {
      const label = new Intl.DateTimeFormat("en-KE", {
        weekday: "long",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(new Date(`${note.date}T12:00:00Z`));
      return `${label}\n${note.text}`;
    })
    .join("\n\n");
}

export function CheckinForm({
  userId,
  weekStart,
  existing,
  dailySummary,
}: Props) {
  const router = useRouter();
  const dailyWins = dailyNotesToWeeklyText(dailySummary?.wins ?? []);
  const dailyBlockers = dailyNotesToWeeklyText(dailySummary?.blockers ?? []);
  const [wins, setWins] = useState(existing?.wins ?? dailyWins);
  const [priorities, setPriorities] = useState(existing?.priorities ?? "");
  const [blockers, setBlockers] = useState(existing?.blockers ?? dailyBlockers);
  const [mood, setMood] = useState<number>(existing?.mood ?? 3);
  const [saving, setSaving] = useState(false);
  const [savedAction, setSavedAction] = useState<"draft" | "submitted" | null>(
    null,
  );
  const [error, setError] = useState("");
  const [editingSubmitted, setEditingSubmitted] = useState(false);
  const isReviewed = existing?.status === "reviewed";
  const isSubmitted = existing?.status === "submitted";
  const weekComplete = dailySummary?.daysLogged === 5;

  async function save(submit: boolean) {
    setSaving(true);
    setError("");
    setSavedAction(null);
    try {
      const res = await fetch("/api/pulse/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          weekStart,
          wins,
          priorities,
          blockers,
          mood,
          status: submit ? "submitted" : "draft",
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok)
        throw new Error(data?.error ?? "Unable to save your check-in.");
      setSavedAction(submit ? "submitted" : "draft");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to save your check-in.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (isReviewed)
    return (
      <ReadOnlyCheckin
        checkin={existing}
        reviewed
        dailySummary={dailySummary}
      />
    );
  if (isSubmitted && !editingSubmitted)
    return (
      <ReadOnlyCheckin
        checkin={existing}
        dailySummary={dailySummary}
        onEdit={() => setEditingSubmitted(true)}
      />
    );

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        save(false);
      }}
    >
      {dailySummary && dailySummary.daysLogged > 0 && (
        <section
          className={`rounded-2xl border p-4 ${weekComplete ? "border-emerald-500/20 bg-emerald-500/[0.05]" : "border-brand-500/15 bg-brand-500/[0.05]"}`}
        >
          <div className="flex items-start gap-3">
            <div className="flex items-center gap-2.5">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${weekComplete ? "bg-emerald-500/10 text-emerald-600" : "bg-brand-500/10 text-brand-500"}`}
              >
                <Icon
                  icon={
                    weekComplete
                      ? "solar:check-circle-broken"
                      : "solar:notebook-broken"
                  }
                  className="h-4 w-4"
                />
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--text-hi)]">
                  {weekComplete
                    ? "Your week is ready to review"
                    : "Work logged this week"}
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-lo)]">
                  {weekComplete
                    ? `All five workdays are logged (${formatMinutes(dailySummary.totalMinutes)}). Add a short reflection, then submit your weekly check-in.`
                    : `${dailySummary.daysLogged}/5 days · ${formatMinutes(dailySummary.totalMinutes)} tracked. Use it to add a short reflection.`}
                </p>
              </div>
            </div>
          </div>
          <DailyActivityBreakdown summary={dailySummary} />
        </section>
      )}
      <div className="space-y-4">
        <Field
          step="1"
          label="Weekly highlights"
          hint="Summarise what moved forward or mattered most."
          icon="solar:cup-star-broken"
          value={wins}
          onChange={setWins}
        />
        <Field
          step="2"
          label="Priorities for next week"
          hint="What are the few outcomes you want to focus on next?"
          icon="solar:target-broken"
          value={priorities}
          onChange={setPriorities}
        />
        <Field
          step="3"
          label="Blockers and support"
          hint="Flag anything that needs a decision, context, or help."
          icon="solar:danger-triangle-broken"
          value={blockers}
          onChange={setBlockers}
          optional
        />
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-xs font-bold text-brand-500">
              4
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--text-hi)]">
                How are you feeling?
              </p>
              <p className="mt-1 text-xs text-[var(--text-lo)]">
                A quick signal helps your manager know when to check in.
              </p>
            </div>
          </div>
          <div className="flex gap-1.5">
            {MOODS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setMood(item.value)}
                title={item.label}
                className={`flex h-10 w-10 flex-col items-center justify-center rounded-xl transition-all ${mood === item.value ? "bg-brand-500 text-white shadow-md shadow-brand-500/25" : "bg-[var(--surface)] text-[var(--text-lo)] hover:bg-brand-500/10"}`}
              >
                <span className="text-lg leading-none">{item.emoji}</span>
                <span className="sr-only">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs font-medium text-[var(--text-lo)]">
          {MOODS.find((item) => item.value === mood)?.label}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-5">
        <div>
          {error && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-red-500">
              <Icon icon="solar:danger-circle-broken" className="h-4 w-4" />
              {error}
            </p>
          )}
          {savedAction && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
              <Icon icon="solar:check-circle-broken" className="h-4 w-4" />
              {savedAction === "submitted"
                ? "Submitted. Your manager can now review this update."
                : "Draft saved. You can keep editing before submitting."}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isSubmitted && (
            <Button
              variant="secondary"
              disabled={saving}
              loading={saving}
              onClick={() => save(false)}
            >
              Save draft
            </Button>
          )}
          <Button
            disabled={saving}
            loading={saving}
            onClick={() => save(true)}
            icon="solar:check-circle-broken"
          >
            {saving
              ? "Saving"
              : isSubmitted
                ? "Resubmit check-in"
                : "Submit check-in"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Field({
  step,
  label,
  hint,
  icon,
  value,
  onChange,
  accessory,
  optional = false,
}: {
  step: string;
  label: string;
  hint: string;
  icon: string;
  value: string;
  onChange: (value: string) => void;
  accessory?: ReactNode;
  optional?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-xs font-bold text-brand-500">
            {step}
          </span>
          <div>
            <label className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-hi)]">
              <Icon icon={icon} className="h-3.5 w-3.5 text-brand-500" />
              {label}
              {optional && (
                <span className="text-xs font-normal text-[var(--text-lo)]">
                  Optional
                </span>
              )}
            </label>
            <p className="mt-0.5 text-xs text-[var(--text-lo)]">{hint}</p>
          </div>
        </div>
        {accessory}
      </div>
      <PlainTextEditor
        value={value}
        onChange={onChange}
        ariaLabel={label}
        className="mt-3"
      />
    </div>
  );
}

function ReadOnlyCheckin({
  checkin,
  reviewed = false,
  onEdit,
  dailySummary,
}: {
  checkin: Checkin;
  reviewed?: boolean;
  onEdit?: () => void;
  dailySummary?: DailyWeekSummary;
}) {
  const mood = MOODS.find((item) => item.value === checkin.mood);
  const tone = reviewed
    ? "border-emerald-500/15 bg-emerald-500/5"
    : "border-blue-500/15 bg-blue-500/5";
  const iconTone = reviewed
    ? "bg-emerald-500/10 text-emerald-600"
    : "bg-blue-500/10 text-blue-600";
  return (
    <div className="space-y-4">
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${tone}`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconTone}`}
          >
            <Icon icon="solar:check-circle-broken" className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-[var(--text-hi)]">
              {reviewed
                ? "This check-in has been reviewed"
                : "This check-in has been submitted"}
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-lo)]">
              {reviewed
                ? "Your update is now part of the conversation with your manager."
                : "Your manager can now review this update."}
            </p>
          </div>
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg border border-blue-500/20 bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-500/5"
          >
            Edit &amp; resubmit
          </button>
        )}
      </div>
      {dailySummary && dailySummary.daysLogged > 0 && (
        <>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-500/[0.05] px-3 py-2.5">
            <span className="inline-flex items-center gap-2 text-xs text-[var(--text-hi)]">
              <Icon
                icon="solar:notebook-broken"
                className="h-4 w-4 text-brand-500"
              />
              Daily work logged this week
            </span>
            <span className="font-mono text-xs font-bold text-brand-500">
              {dailySummary.daysLogged}/5 ·{" "}
              {formatMinutes(dailySummary.totalMinutes)}
            </span>
          </div>
          <DailyActivityBreakdown summary={dailySummary} />
        </>
      )}
      <ReadField
        label="Wins and accomplishments"
        icon="solar:cup-star-broken"
        value={checkin.wins}
      />
      <ReadField
        label="Priorities for next week"
        icon="solar:target-broken"
        value={checkin.priorities}
      />
      <ReadField
        label="Blockers and support"
        icon="solar:danger-triangle-broken"
        value={checkin.blockers}
      />
      <div className="flex items-center gap-2 rounded-xl bg-[var(--surface-2)] px-3 py-2.5">
        <span className="text-lg">{mood?.emoji ?? "—"}</span>
        <span className="text-sm font-medium text-[var(--text-hi)]">
          {mood?.label ?? "Mood not recorded"}
        </span>
      </div>
      {checkin.manager_comment && (
        <div className="rounded-xl border border-blue-500/15 bg-blue-500/5 p-4">
          <p className="text-xs font-semibold text-blue-600">
            Manager feedback
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-hi)]">
            {checkin.manager_comment}
          </p>
        </div>
      )}
    </div>
  );
}

function DailyActivityBreakdown({ summary }: { summary: DailyWeekSummary }) {
  return (
    <Accordion
      className="mt-3"
      title="View daily activity breakdown"
      subtitle={`${summary.daysLogged}/5 workdays logged`}
      icon="solar:list-check-broken"
      badge={formatMinutes(summary.totalMinutes)}
    >
      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {summary.days.map((day, dayIndex) => (
          <Accordion
            key={day.date}
            title={new Date(`${day.date}T12:00:00`).toLocaleDateString(
              "en-KE",
              {
                weekday: "long",
                day: "numeric",
                month: "short",
              },
            )}
            subtitle={`${day.entries.length} logged task${day.entries.length === 1 ? "" : "s"}`}
            icon="solar:calendar-broken"
            badge={formatMinutes(
              day.entries.reduce((total, entry) => total + entry.minutes, 0),
            )}
            defaultOpen={dayIndex === summary.days.length - 1}
          >
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <div className="hidden min-w-[600px] grid-cols-[minmax(220px,1fr)_minmax(130px,.65fr)_120px_80px] gap-3 border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 sm:grid">
                {["Activity", "Client / project", "Category", "Time"].map(
                  (label) => (
                    <span
                      key={label}
                      className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-lo)]"
                    >
                      {label}
                    </span>
                  ),
                )}
              </div>
              {day.entries.map((entry, index) => (
                <div
                  key={`${entry.task}-${index}`}
                  className="grid gap-x-3 gap-y-2 border-b border-[var(--border)] px-3 py-3 last:border-0 sm:grid-cols-[minmax(220px,1fr)_minmax(130px,.65fr)_120px_80px] sm:items-center sm:py-2.5"
                >
                  <div className="min-w-0">
                    <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-lo)] sm:hidden">
                      Activity
                    </span>
                    <p className="truncate text-xs font-medium text-[var(--text-hi)]">
                      {entry.task}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-lo)] sm:hidden">
                      Client / project
                    </span>
                    <p className="truncate text-xs text-[var(--text-lo)]">
                      {entry.client || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-lo)] sm:hidden">
                      Category
                    </span>
                    <span className="inline-flex rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-lo)]">
                      {entry.category}
                    </span>
                  </div>
                  <div>
                    <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-lo)] sm:hidden">
                      Time
                    </span>
                    <span className="font-mono text-xs font-semibold text-[var(--text-hi)]">
                      {formatMinutes(entry.minutes)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Accordion>
        ))}
      </div>
    </Accordion>
  );
}

function ReadField({
  label,
  icon,
  value,
}: {
  label: string;
  icon: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <div className="flex items-center gap-2">
        <Icon icon={icon} className="h-4 w-4 text-brand-500" />
        <p className="text-xs font-semibold text-[var(--text-hi)]">{label}</p>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-lo)]">
        {value || "Not filled in"}
      </p>
    </div>
  );
}
