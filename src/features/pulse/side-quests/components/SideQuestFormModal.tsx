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
] as const;

const questTemplates = [
  {
    id: "asana-clean-up",
    label: "Asana clean-up",
    title: "Asana clean-up sprint",
    brief: "Keep project work accurate, owned, and ready for the week ahead.",
    criteria:
      "Update assigned tasks, owners, due dates and statuses; attach a screenshot or task link for approval.",
    points: 15,
    xp: 10,
    frequency: "weekly",
    cap: 1,
    completionMode: "evidence_required",
  },
  {
    id: "digital-watercooler",
    label: "Digital Watercooler",
    title: "Spark the Digital Watercooler",
    brief:
      "Start a useful, inclusive conversation that helps the team connect or learn.",
    criteria:
      "Post the prompt or contribution and share the message link for review.",
    points: 10,
    xp: 8,
    frequency: "weekly",
    cap: 1,
    completionMode: "evidence_required",
  },
  {
    id: "productivity-hack",
    label: "Productivity Hack Share",
    title: "Share a productivity hack",
    brief:
      "Give the team one practical shortcut, workflow, or tool they can reuse.",
    criteria:
      "Share the hack with a short how-to and evidence of where it was posted.",
    points: 15,
    xp: 12,
    frequency: "monthly",
    cap: 1,
    completionMode: "evidence_required",
  },
  {
    id: "masterclass",
    label: "Masterclass",
    title: "Host a Growthpad Masterclass",
    brief:
      "Train the team on a tool, framework, or hard skill they can apply in their work.",
    criteria:
      "Run the session and submit the slide, recording, or meeting link for approval.",
    points: 30,
    xp: 25,
    frequency: "monthly",
    cap: 1,
    completionMode: "manager_approval",
  },
  {
    id: "framework-sharer",
    label: "Framework Sharer",
    title: "Share a reusable framework",
    brief:
      "Turn a useful approach into a template or framework the team can adopt.",
    criteria:
      "Submit the framework link and a short note on when colleagues should use it.",
    points: 20,
    xp: 18,
    frequency: "monthly",
    cap: 1,
    completionMode: "manager_approval",
  },
  {
    id: "client-hero",
    label: "Client Hero Spotlight",
    title: "Capture a Client Hero story",
    brief: "Document exceptional work that created a tangible client outcome.",
    criteria:
      "Submit the client context, outcome, evidence and permission to share where required.",
    points: 25,
    xp: 20,
    frequency: "monthly",
    cap: 1,
    completionMode: "manager_approval",
  },
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
  const [xpPoints, setXpPoints] = useState(String(quest?.xp_points ?? 0));
  const [repeatFrequency, setRepeatFrequency] = useState(
    quest?.repeat_frequency ?? "once",
  );
  const [completionCap, setCompletionCap] = useState(
    String(quest?.max_completions_per_period ?? 1),
  );
  const [approverId, setApproverId] = useState(quest?.approver_id ?? "");
  const [completionMode, setCompletionMode] = useState(
    quest?.completion_mode ?? "self_confirm",
  );
  const [lifecycle, setLifecycle] = useState(quest?.status ?? "live");
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

  function applyTemplate(id: string) {
    const template = questTemplates.find((item) => item.id === id);
    if (!template) return;
    setTitle(template.title);
    setBrief(template.brief);
    setCriteria(template.criteria);
    setPoints(String(template.points));
    setXpPoints(String(template.xp));
    setRepeatFrequency(template.frequency as "once" | "weekly" | "monthly");
    setCompletionCap(String(template.cap));
    setCompletionMode(
      template.completionMode as
        "self_confirm" | "evidence_required" | "manager_approval",
    );
  }

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
      xp_points: Number(xpPoints) || 0,
      repeat_frequency: repeatFrequency,
      max_completions_per_period: Number(completionCap) || 1,
      approver_id: approverId || null,
      completion_mode: completionMode,
      status: lifecycle,
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
      {!quest && (
        <div>
          <label className={labelClass}>
            Start from a template{" "}
            <span className="font-normal text-[var(--text-lo)]">Optional</span>
          </label>
          <select
            defaultValue=""
            onChange={(event) => applyTemplate(event.target.value)}
            className={inputClass}
          >
            <option value="">Choose a starting point</option>
            {questTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className={labelClass}>Quest status</label>
        <select
          value={lifecycle}
          onChange={(event) =>
            setLifecycle(event.target.value as typeof lifecycle)
          }
          className={inputClass}
        >
          <option value="draft">Draft</option>
          <option value="upcoming">Scheduled</option>
          <option value="live">Live now</option>
          <option value="closed">Closed</option>
          <option value="archived">Archived</option>
        </select>
      </div>
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
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          Reward points on completion
          <input
            type="number"
            min={0}
            max={1000}
            value={points}
            onChange={(event) => setPoints(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Quarterly XP on completion
          <input
            type="number"
            min={0}
            max={1000}
            value={xpPoints}
            onChange={(event) => setXpPoints(event.target.value)}
            className={inputClass}
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Completion frequency</span>
          <select
            value={repeatFrequency}
            onChange={(event) =>
              setRepeatFrequency(
                event.target.value as "once" | "weekly" | "monthly",
              )
            }
            className={inputClass}
          >
            <option value="once">One time</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Max completions per period</span>
          <input
            type="number"
            min={1}
            max={52}
            value={completionCap}
            onChange={(event) => setCompletionCap(event.target.value)}
            disabled={repeatFrequency === "once"}
            className={`${inputClass} disabled:opacity-50`}
          />
        </label>
      </div>
      <div>
        <label className={labelClass}>
          Designated approver{" "}
          <span className="font-normal text-[var(--text-lo)]">Optional</span>
        </label>
        <select
          value={approverId}
          onChange={(event) => setApproverId(event.target.value)}
          className={inputClass}
        >
          <option value="">Any Side Quest manager</option>
          {options.staff.map((staff) => (
            <option key={staff.id} value={staff.id}>
              {staff.name}
            </option>
          ))}
        </select>
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
        <p className="mb-2 text-xs text-[var(--text-lo)]">
          Times use East Africa Time (EAT, UTC+3).
        </p>
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
  const [actionsOpen, setActionsOpen] = useState(false);
  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setActionsOpen((current) => !current)}
          aria-label="Side Quest actions"
          aria-expanded={actionsOpen}
          title="Side Quest actions"
          className="rounded-lg p-1.5 text-[var(--text-lo)] transition-colors hover:bg-[var(--surface-2)] hover:text-brand-500"
        >
          <Icon icon="solar:menu-dots-broken" className="h-4 w-4" />
        </button>
        {actionsOpen && (
          <div className="absolute right-0 top-full z-20 mt-1 w-32 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-xl shadow-slate-200/30 dark:shadow-black/30">
            <button
              type="button"
              onClick={() => {
                setActionsOpen(false);
                setOpen(true);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-[var(--text-hi)] transition-colors hover:bg-[var(--surface-2)]"
            >
              <Icon icon="solar:pen-broken" className="h-3.5 w-3.5" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => {
                setActionsOpen(false);
                setConfirmingDelete(true);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-red-500 transition-colors hover:bg-red-500/10"
            >
              <Icon
                icon="solar:trash-bin-minimalistic-broken"
                className="h-3.5 w-3.5"
              />
              Delete
            </button>
          </div>
        )}
      </div>
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
