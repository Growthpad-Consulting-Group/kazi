"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/Button";
import DateRangePicker from "@/components/ui/DateRangePicker";
import { SimpleModal } from "@/components/ui/SimpleModal";
import type { Database } from "@/types/database";

type SideQuest = Database["public"]["Tables"]["side_quests"]["Row"];

const audiences = [
  { value: "company", label: "Company-wide" },
  { value: "department", label: "Department" },
  { value: "location", label: "Location" },
  { value: "manager_group", label: "Manager group" },
  { value: "staff", label: "Selected staff" },
];

export type AudienceOptions = {
  departments: string[];
  locations: string[];
  managers: { id: string; name: string }[];
  staff: { id: string; name: string }[];
};

function toDateValue(value: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function splitDateTime(value: string | null) {
  if (!value) return { date: "", time: "" };
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

const inputClass =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500/60";
const labelClass = "mb-1.5 block text-xs font-semibold text-[var(--text-hi)]";

function SideQuestForm({
  quest,
  options,
  onDone,
}: {
  quest?: SideQuest;
  options: AudienceOptions;
  onDone: () => void;
}) {
  const router = useRouter();
  const start = splitDateTime(quest?.starts_at ?? null);
  const end = splitDateTime(quest?.ends_at ?? null);
  const [title, setTitle] = useState(quest?.title ?? "");
  const [brief, setBrief] = useState(quest?.brief ?? "");
  const [criteria, setCriteria] = useState(quest?.completion_criteria ?? "");
  const [points, setPoints] = useState(String(quest?.points ?? 10));
  const [completionMode, setCompletionMode] = useState(
    quest?.completion_mode ?? "self_confirm",
  );
  const [audience, setAudience] = useState(quest?.audience_type ?? "company");
  const [filters, setFilters] = useState<string[]>(
    quest?.audience_filters ?? [],
  );
  const [startDate, setStartDate] = useState(start.date);
  const [startTime, setStartTime] = useState(start.time);
  const [endDate, setEndDate] = useState(end.date);
  const [endTime, setEndTime] = useState(end.time);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const targets =
    audience === "department"
      ? options.departments.map((value) => ({ value, label: value }))
      : audience === "location"
        ? options.locations.map((value) => ({ value, label: value }))
        : audience === "manager_group"
          ? options.managers.map((value) => ({
              value: value.id,
              label: value.name,
            }))
          : options.staff.map((value) => ({
              value: value.id,
              label: value.name,
            }));

  async function submit() {
    if (!title.trim() || !brief.trim() || !criteria.trim()) return;
    if (audience !== "company" && !filters.length) {
      setError("Choose at least one eligible audience target.");
      return;
    }
    const payload = {
      title,
      brief,
      completion_criteria: criteria,
      points: Number(points) || 0,
      completion_mode: completionMode,
      audience_type: audience,
      audience_filters: filters,
      starts_at: startDate ? `${startDate}T${startTime || "09:00"}:00` : null,
      ends_at: endDate ? `${endDate}T${endTime || "17:00"}:00` : null,
    };
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        quest ? `/api/pulse/side-quests/${quest.id}` : "/api/pulse/side-quests",
        {
          method: quest ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok)
        throw new Error(data?.error ?? "Could not save this Side Quest.");
      onDone();
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not save this Side Quest.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Challenge name</label>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Share a customer learning"
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Brief</label>
        <textarea
          rows={3}
          value={brief}
          onChange={(event) => setBrief(event.target.value)}
          placeholder="What should staff do, and why does it matter?"
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Completion criteria</label>
        <input
          value={criteria}
          onChange={(event) => setCriteria(event.target.value)}
          placeholder="e.g. Post one learning in the Friday channel"
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Points awarded on completion</label>
        <input
          type="number"
          min={0}
          max={1000}
          value={points}
          onChange={(event) => setPoints(event.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>How completion is verified</label>
        <select
          value={completionMode}
          onChange={(event) =>
            setCompletionMode(
              event.target.value as
                "self_confirm" | "evidence_required" | "manager_approval",
            )
          }
          className={inputClass}
        >
          <option value="self_confirm">
            Self-confirm — award points immediately
          </option>
          <option value="evidence_required">
            Evidence required — manager approves
          </option>
          <option value="manager_approval">
            Manager approval — optional note or link
          </option>
        </select>
        <p className="mt-1.5 text-xs text-[var(--text-lo)]">
          Use approval for rewards that need a quick human check.
        </p>
      </div>
      <div>
        <label className={labelClass}>Eligible audience</label>
        <select
          value={audience}
          onChange={(event) => {
            setAudience(event.target.value as typeof audience);
            setFilters([]);
          }}
          className={inputClass}
        >
          {audiences.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      {audience !== "company" && (
        <div>
          <label className={labelClass}>
            Choose eligible{" "}
            {audience === "staff"
              ? "staff"
              : audience === "manager_group"
                ? "manager groups"
                : audience}
            s
          </label>
          <select
            multiple
            size={Math.min(Math.max(targets.length, 3), 5)}
            value={filters}
            onChange={(event) =>
              setFilters(
                Array.from(
                  event.target.selectedOptions,
                  (option) => option.value,
                ),
              )
            }
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-hi)]"
          >
            {targets.map((target) => (
              <option key={target.value} value={target.value}>
                {target.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className={labelClass}>
          Quest window{" "}
          <span className="font-normal text-[var(--text-lo)]">Optional</span>
        </label>
        <DateRangePicker
          value={{
            startDate: startDate ? new Date(`${startDate}T12:00:00`) : null,
            endDate: endDate ? new Date(`${endDate}T12:00:00`) : null,
          }}
          onChange={(range) => {
            setStartDate(range.startDate ? toDateValue(range.startDate) : "");
            setEndDate(range.endDate ? toDateValue(range.endDate) : "");
          }}
          allowedRanges={["Custom Range"]}
          maxDate={null}
          fullWidth
        />
        <div className="mt-2 grid grid-cols-2 gap-3">
          <label className="block text-[11px] font-medium text-[var(--text-lo)]">
            Start time
            <input
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              disabled={!startDate}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-2 text-sm text-[var(--text-hi)] disabled:opacity-50"
            />
          </label>
          <label className="block text-[11px] font-medium text-[var(--text-lo)]">
            End time
            <input
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              disabled={!endDate}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-2 text-sm text-[var(--text-hi)] disabled:opacity-50"
            />
          </label>
        </div>
      </div>
      {error && <p className="text-xs font-medium text-red-500">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button
          icon="solar:cup-star-broken"
          loading={saving}
          disabled={
            saving || !title.trim() || !brief.trim() || !criteria.trim()
          }
          onClick={submit}
        >
          {saving ? "Saving" : quest ? "Save changes" : "Create quest"}
        </Button>
      </div>
    </div>
  );
}

export function NewSideQuestButton({ options }: { options: AudienceOptions }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="sm"
        icon="solar:cup-star-broken"
        onClick={() => setOpen(true)}
      >
        New Side Quest
      </Button>
      <SimpleModal
        open={open}
        onClose={() => setOpen(false)}
        title="New Side Quest"
        icon="solar:cup-star-broken"
        maxWidth="max-w-lg"
      >
        {open && (
          <SideQuestForm options={options} onDone={() => setOpen(false)} />
        )}
      </SimpleModal>
    </>
  );
}

function DeleteSideQuestConfirm({
  quest,
  onClose,
}: {
  quest: SideQuest;
  onClose: () => void;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  async function remove() {
    setDeleting(true);
    try {
      const response = await fetch(`/api/pulse/side-quests/${quest.id}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok)
        throw new Error(data?.error ?? "Could not delete this Side Quest.");
      onClose();
      router.refresh();
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Could not delete this Side Quest.",
      );
    } finally {
      setDeleting(false);
    }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-[var(--text-lo)]">
        Delete{" "}
        <span className="font-semibold text-[var(--text-hi)]">
          {quest.title}
        </span>
        ? Its completions are removed, and any points awarded for it are taken
        back.
      </p>
      <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="danger"
          loading={deleting}
          icon="solar:trash-bin-minimalistic-broken"
          onClick={remove}
        >
          Delete quest
        </Button>
      </div>
    </div>
  );
}

export function EditSideQuestButton({
  quest,
  options,
}: {
  quest: SideQuest;
  options: AudienceOptions;
}) {
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Edit Side Quest"
        title="Edit Side Quest"
        className="rounded-lg p-1.5 text-[var(--text-lo)] transition-colors hover:bg-[var(--surface-2)] hover:text-brand-500"
      >
        <Icon icon="solar:pen-broken" className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => setConfirmingDelete(true)}
        aria-label="Delete Side Quest"
        title="Delete Side Quest"
        className="rounded-lg p-1.5 text-[var(--text-lo)] transition-colors hover:bg-red-500/10 hover:text-red-500"
      >
        <Icon icon="solar:trash-bin-minimalistic-broken" className="h-4 w-4" />
      </button>
      <SimpleModal
        open={open}
        onClose={() => setOpen(false)}
        title="Edit Side Quest"
        icon="solar:pen-broken"
        maxWidth="max-w-lg"
      >
        {open && (
          <SideQuestForm
            quest={quest}
            options={options}
            onDone={() => setOpen(false)}
          />
        )}
      </SimpleModal>
      <SimpleModal
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title="Delete Side Quest?"
        icon="solar:danger-triangle-broken"
        maxWidth="max-w-sm"
      >
        {confirmingDelete && (
          <DeleteSideQuestConfirm
            quest={quest}
            onClose={() => setConfirmingDelete(false)}
          />
        )}
      </SimpleModal>
    </>
  );
}
