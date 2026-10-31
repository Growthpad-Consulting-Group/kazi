"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";
import { ClientSelect } from "./ClientSelect";
import {
  DAILY_LOG_CATEGORIES,
  type DailyLogCategory,
  type DailyLogEntry,
} from "../constants";

export type RecurringWorkRoutine = {
  id: string;
  title: string;
  client: string | null;
  category: DailyLogCategory;
  minutes: number;
  cadence: "daily" | "weekdays" | "weekly" | "custom";
  weekdays: number[];
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EMPTY = {
  title: "",
  client: "",
  category: "Projects" as DailyLogCategory,
  minutes: "30",
  cadence: "weekdays" as RecurringWorkRoutine["cadence"],
  weekdays: [1, 2, 3, 4, 5],
};

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours && remainder
    ? `${hours}h ${remainder}m`
    : hours
      ? `${hours}h`
      : `${remainder}m`;
}

function isDue(routine: RecurringWorkRoutine, date: string) {
  const day = new Date(`${date}T12:00:00`).getDay();
  if (routine.cadence === "daily") return true;
  if (routine.cadence === "weekdays") return day >= 1 && day <= 5;
  return routine.weekdays.includes(day);
}

export function RecurringWorkManager({
  date,
  onAdd,
  clients,
  onClientCreated,
  showManageTrigger = true,
  showSuggestions = true,
}: {
  date: string;
  onAdd: (entry: DailyLogEntry) => void;
  clients: string[];
  onClientCreated: (name: string) => void;
  showManageTrigger?: boolean;
  showSuggestions?: boolean;
}) {
  const [routines, setRoutines] = useState<RecurringWorkRoutine[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<RecurringWorkRoutine | null>(null);
  const [form, setForm] = useState(EMPTY);

  const due = useMemo(
    () => routines.filter((routine) => isDue(routine, date)),
    [date, routines],
  );

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/pulse/daily-log/routines");
      const payload = (await response.json()) as {
        routines?: RecurringWorkRoutine[];
        error?: string;
      };
      if (!response.ok)
        throw new Error(payload.error ?? "Could not load routines.");
      setRoutines(payload.routines ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load routines.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches component-local routines once on mount.
    void load();
    const refresh = () => void load();
    window.addEventListener("recurring-work-updated", refresh);
    return () => window.removeEventListener("recurring-work-updated", refresh);
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };
  const openEdit = (routine: RecurringWorkRoutine) => {
    setEditing(routine);
    setForm({
      title: routine.title,
      client: routine.client ?? "",
      category: routine.category,
      minutes: String(routine.minutes),
      cadence: routine.cadence,
      weekdays: routine.weekdays,
    });
    setOpen(true);
  };
  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/pulse/daily-log/routines", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          id: editing?.id,
          minutes: Number(form.minutes),
        }),
      });
      const payload = (await response.json()) as {
        routine?: RecurringWorkRoutine;
        error?: string;
      };
      if (!response.ok || !payload.routine)
        throw new Error(payload.error ?? "Could not save this routine.");
      setRoutines((current) =>
        editing
          ? current.map((routine) =>
              routine.id === editing.id ? payload.routine! : routine,
            )
          : [payload.routine!, ...current],
      );
      window.dispatchEvent(new Event("recurring-work-updated"));
      setOpen(false);
      toast.success(editing ? "Routine updated" : "Routine added");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save this routine.",
      );
    } finally {
      setSaving(false);
    }
  };
  const remove = async (routine: RecurringWorkRoutine) => {
    if (!window.confirm(`Remove “${routine.title}” from your routines?`))
      return;
    const response = await fetch(
      `/api/pulse/daily-log/routines?id=${routine.id}`,
      { method: "DELETE" },
    );
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    if (!response.ok)
      return toast.error(payload?.error ?? "Could not remove this routine.");
    setRoutines((current) => current.filter((item) => item.id !== routine.id));
    window.dispatchEvent(new Event("recurring-work-updated"));
    toast.success("Routine removed");
  };
  const toggleDay = (day: number) =>
    setForm((current) => ({
      ...current,
      weekdays: current.weekdays.includes(day)
        ? current.weekdays.filter((item) => item !== day)
        : current.cadence === "weekly"
          ? [day]
          : [...current.weekdays, day].sort(),
    }));

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {!showSuggestions || loading ? null : due.length ? (
          <>
            <span className="text-xs font-medium text-[var(--text-lo)]">
              Quick add
            </span>
            {due.map((routine) => (
              <button
                key={routine.id}
                type="button"
                onClick={() =>
                  onAdd({
                    task: routine.title,
                    client: routine.client,
                    minutes: routine.minutes,
                    category: routine.category,
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-brand-500/20 bg-brand-500/[0.06] px-2.5 py-1.5 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-500/12 dark:text-brand-400"
                title={`Add ${routine.title} (${formatMinutes(routine.minutes)})`}
              >
                <Icon icon="solar:add-circle-broken" className="h-3.5 w-3.5" />
                <span className="max-w-40 truncate">{routine.title}</span>
                <span className="text-brand-500/80">
                  {formatMinutes(routine.minutes)}
                </span>
              </button>
            ))}
          </>
        ) : null}
        {showManageTrigger && (
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--text-lo)] transition-colors hover:text-[var(--text-hi)]"
          >
            <Icon icon="solar:repeat-broken" className="h-3.5 w-3.5" />
            Manage routines
          </button>
        )}
      </div>

      <SimpleModal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit recurring work" : "Add recurring work"}
        subtitle="Suggestions help you log real work faster. Time is added only when you choose it."
        icon="solar:repeat-broken"
      >
        <div className="space-y-4">
          <label className="block text-sm font-medium text-[var(--text-hi)]">
            Routine
            <input
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              placeholder="e.g. Review client inbox"
              maxLength={200}
              className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-[var(--text-hi)]">
              Client or project{" "}
              <span className="font-normal text-[var(--text-lo)]">
                Optional
              </span>
              <div className="mt-1.5">
                <ClientSelect
                  value={form.client}
                  clients={clients}
                  onChange={(client) =>
                    setForm((current) => ({ ...current, client }))
                  }
                  onClientCreated={onClientCreated}
                />
              </div>
            </label>
            <label className="block text-sm font-medium text-[var(--text-hi)]">
              Expected duration
              <input
                type="number"
                min="1"
                max="1440"
                value={form.minutes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    minutes: event.target.value,
                  }))
                }
                className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-[var(--text-hi)]">
              Category
              <select
                value={form.category}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    category: event.target.value as DailyLogCategory,
                  }))
                }
                className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-brand-500"
              >
                {DAILY_LOG_CATEGORIES.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-[var(--text-hi)]">
              Cadence
              <select
                value={form.cadence}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    cadence: event.target
                      .value as RecurringWorkRoutine["cadence"],
                    weekdays:
                      event.target.value === "weekdays"
                        ? [1, 2, 3, 4, 5]
                        : event.target.value === "daily"
                          ? []
                          : current.weekdays,
                  }))
                }
                className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-brand-500"
              >
                <option value="daily">Every day</option>
                <option value="weekdays">Weekdays</option>
                <option value="weekly">Weekly</option>
                <option value="custom">Selected days</option>
              </select>
            </label>
          </div>
          {(form.cadence === "weekly" || form.cadence === "custom") && (
            <div>
              <p className="text-sm font-medium text-[var(--text-hi)]">
                Show on
              </p>
              <div className="mt-2 flex gap-1.5">
                {DAYS.map((day, index) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(index)}
                    className={`h-9 min-w-9 rounded-lg text-xs font-medium ${form.weekdays.includes(index) ? "bg-brand-500 text-white" : "bg-[var(--surface-2)] text-[var(--text-lo)] hover:text-[var(--text-hi)]"}`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-[var(--border)] pt-4">
            {editing ? (
              <button
                type="button"
                onClick={() => remove(editing)}
                className="text-sm font-medium text-red-500 hover:underline"
              >
                Remove
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button loading={saving} onClick={save}>
                {editing ? "Save changes" : "Add routine"}
              </Button>
            </div>
          </div>
          {routines.length > 0 && !editing && (
            <div className="border-t border-[var(--border)] pt-4">
              <p className="mb-2 text-sm font-semibold text-[var(--text-lo)]">
                Your routines
              </p>
              <div className="space-y-1">
                {routines.map((routine) => (
                  <div
                    key={routine.id}
                    className="flex items-center gap-1 rounded-xl px-2 py-1 hover:bg-[var(--surface-2)]"
                  >
                    <button
                      type="button"
                      onClick={() => openEdit(routine)}
                      className="flex min-w-0 flex-1 items-center justify-between py-1 text-left"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-[var(--text-hi)]">
                          {routine.title}
                        </span>
                        <span className="text-xs text-[var(--text-lo)]">
                          {formatMinutes(routine.minutes)} ·{" "}
                          {routine.cadence === "weekdays"
                            ? "Weekdays"
                            : routine.cadence === "daily"
                              ? "Every day"
                              : routine.cadence === "weekly"
                                ? "Weekly"
                                : "Selected days"}
                        </span>
                      </span>
                      <Icon
                        icon="solar:pen-new-square-broken"
                        className="h-4 w-4 shrink-0 text-[var(--text-lo)]"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(routine)}
                      aria-label={`Remove ${routine.title}`}
                      title="Remove routine"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-lo)] transition-colors hover:bg-red-500/10 hover:text-red-500"
                    >
                      <Icon
                        icon="solar:trash-bin-minimalistic-broken"
                        className="h-4 w-4"
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SimpleModal>
    </>
  );
}

export function ManageRecurringWorkButton({
  date,
  clients,
  onClientCreated,
}: {
  date: string;
  clients: string[];
  onClientCreated: (name: string) => void;
}) {
  return (
    <RecurringWorkManager
      date={date}
      clients={clients}
      onClientCreated={onClientCreated}
      onAdd={() => undefined}
      showSuggestions={false}
    />
  );
}
