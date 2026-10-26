"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import DateRangePicker from "@/components/ui/DateRangePicker";
import { SimpleModal } from "@/components/ui/SimpleModal";
import StatCard from "@/components/ui/StatCard";
import type { Idp, IdpStatus } from "@/types/database";

type Action = { text: string; due_date: string | null; done: boolean };

const STATUS_OPTIONS: { value: IdpStatus; label: string; tone: string }[] = [
  { value: "active", label: "Active", tone: "bg-blue-500/10 text-blue-600 ring-blue-500/30" },
  { value: "completed", label: "Completed", tone: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/30" },
  { value: "cancelled", label: "Cancelled", tone: "bg-slate-500/10 text-slate-600 ring-slate-500/30" },
];

const inputClass = "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60";

function toDateValue(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

export function IdpDetail({ idp, canEdit, canDelete }: { idp: Idp; canEdit: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState(idp.title);
  const [goals, setGoals] = useState(idp.goals ?? "");
  const [startDate, setStartDate] = useState(idp.start_date ?? "");
  const [dueDate, setDueDate] = useState(idp.due_date ?? "");
  const [actions, setActions] = useState<Action[]>(idp.actions ?? []);
  const [newAction, setNewAction] = useState("");
  const [newDue, setNewDue] = useState("");
  const [status, setStatus] = useState<IdpStatus>(idp.status);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const done = actions.filter((action) => action.done).length;
  const progress = actions.length ? Math.round((done / actions.length) * 100) : 0;
  const remaining = actions.length - done;
  const statusMeta = STATUS_OPTIONS.find((option) => option.value === status) ?? STATUS_OPTIONS[0];
  const dirty =
    title !== idp.title ||
    goals !== (idp.goals ?? "") ||
    startDate !== (idp.start_date ?? "") ||
    dueDate !== (idp.due_date ?? "") ||
    status !== idp.status ||
    JSON.stringify(actions) !== JSON.stringify(idp.actions ?? []);

  async function save() {
    if (!title.trim()) {
      toast.error("A plan needs a title.");
      return;
    }
    if (startDate && dueDate && dueDate < startDate) {
      toast.error("The target date must be on or after the start date.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/pulse/idps/${idp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, goals, start_date: startDate || null, due_date: dueDate || null, actions, status }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Could not save the plan.");
      toast.success("Plan saved");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the plan.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      const response = await fetch(`/api/pulse/idps/${idp.id}`, { method: "DELETE" });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Could not delete the plan.");
      toast.success("Plan deleted");
      router.push("/pulse/idps");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the plan.");
      setSaving(false);
    }
  }

  function addAction() {
    if (!newAction.trim()) return;
    setActions([...actions, { text: newAction.trim(), due_date: newDue || null, done: false }]);
    setNewAction("");
    setNewDue("");
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="relative min-w-0 flex-1">
            <div className="mb-4 flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500"><Icon icon="solar:book-broken" className="h-4 w-4" /></span><div><p className="text-sm font-semibold text-[var(--text-hi)]">Development plan</p><p className="text-[11px] text-[var(--text-lo)]">A practical path from intent to progress.</p></div></div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-lo)]">Plan title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} maxLength={200} className={`${inputClass} mt-1.5 text-base font-semibold`} />
          </div>
          {canDelete && (
            <Button variant="danger" size="sm" icon="solar:trash-bin-minimalistic-broken" onClick={() => setConfirmingDelete(true)}>Delete plan</Button>
          )}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-lo)]">Status</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setStatus(option.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 transition-colors disabled:opacity-60 ${status === option.value ? option.tone : "bg-[var(--surface-2)] text-[var(--text-lo)] ring-transparent"}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-lo)]">Plan window</p>
            <div className="mt-1.5">
              {canEdit ? (
                <DateRangePicker
                  value={{ startDate: startDate ? new Date(`${startDate}T12:00:00`) : null, endDate: dueDate ? new Date(`${dueDate}T12:00:00`) : null }}
                  onChange={(range) => {
                    setStartDate(range.startDate ? toDateValue(range.startDate) : "");
                    setDueDate(range.endDate ? toDateValue(range.endDate) : "");
                  }}
                  allowedRanges={["Custom Range"]}
                  maxDate={null}
                  fullWidth
                />
              ) : (
                <p className="text-sm text-[var(--text-hi)]">
                  {startDate ? formatDate(startDate) : "No start date"} – {dueDate ? formatDate(dueDate) : "No target date"}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard variant="inline" compact title="Progress" value={`${progress}%`} icon="solar:chart-2-broken" color="blue" subtitle={actions.length ? `${done} of ${actions.length} steps done` : "Add action steps"} />
        <StatCard variant="inline" compact title="Remaining" value={remaining} icon="solar:checklist-minimalistic-broken" color={remaining ? "amber" : "green"} subtitle={remaining ? "Actions to complete" : "All caught up"} />
        <StatCard variant="inline" compact title="Status" value={statusMeta.label} icon="solar:flag-broken" color={status === "completed" ? "green" : status === "cancelled" ? "slate" : "orange"} subtitle={status === "active" ? "Currently in motion" : "Plan state"} />
        <StatCard variant="inline" compact title="Target" value={dueDate ? formatDate(dueDate) : "—"} icon="solar:calendar-broken" color={dueDate ? "blue" : "slate"} subtitle={startDate ? `Started ${formatDate(startDate)}` : "No start date"} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6">
        <div className="flex items-center gap-2.5"><span className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500"><Icon icon="solar:target-broken" className="h-3.5 w-3.5" /></span><div><h2 className="text-sm font-semibold text-[var(--text-hi)]">Outcome</h2><p className="text-[11px] text-[var(--text-lo)]">What this plan is working toward.</p></div></div>
        <textarea
          rows={4}
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          disabled={!canEdit}
          placeholder="What do you want to achieve? How will success be measured?"
          className={`${inputClass} resize-y leading-relaxed`}
        />
      </section>

      <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5"><span className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500"><Icon icon="solar:checklist-minimalistic-broken" className="h-3.5 w-3.5" /></span><div><h2 className="text-sm font-semibold text-[var(--text-hi)]">Action steps</h2><p className="text-[11px] text-[var(--text-lo)]">Turn the goal into visible weekly progress.</p></div></div>
          {actions.length > 0 && (
            <span className="font-mono text-[11px] text-[var(--text-lo)]">{done}/{actions.length} done · {progress}%</span>
          )}
        </div>
        {actions.length > 0 && (
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-orange-400 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        )}
        <ul className="space-y-2">
          {actions.map((action, index) => (
            <li key={index} className="flex items-center gap-3 rounded-xl bg-[var(--surface-2)] px-3 py-2.5">
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => setActions(actions.map((item, i) => (i === index ? { ...item, done: !item.done } : item)))}
                aria-label={action.done ? "Mark not done" : "Mark done"}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors disabled:opacity-60 ${action.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-[var(--border)] bg-[var(--surface)]"}`}
              >
                {action.done && <Icon icon="solar:check-read-broken" className="h-3.5 w-3.5" />}
              </button>
              <span className={`min-w-0 flex-1 text-sm ${action.done ? "text-[var(--text-lo)] line-through" : "text-[var(--text-hi)]"}`}>{action.text}</span>
              {action.due_date && <span className="shrink-0 text-[11px] text-[var(--text-lo)]">{formatDate(action.due_date)}</span>}
              {canEdit && (
                <button type="button" onClick={() => setActions(actions.filter((_, i) => i !== index))} aria-label="Remove step" className="shrink-0 rounded p-0.5 text-[var(--text-lo)] hover:text-red-500">
                  <Icon icon="solar:close-circle-broken" className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
          {actions.length === 0 && <li className="rounded-xl bg-[var(--surface-2)] px-3 py-4 text-center text-xs text-[var(--text-lo)]">No action steps yet.</li>}
        </ul>
        {canEdit && (
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_200px_auto]">
            <input
              value={newAction}
              onChange={(e) => setNewAction(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addAction()}
              placeholder="Add an action step…"
              className={inputClass}
            />
            <DatePicker value={newDue} onChange={setNewDue} placeholder="Step due date" />
            <Button variant="secondary" disabled={!newAction.trim()} onClick={addAction}>Add</Button>
          </div>
        )}
      </section>
      </div>

      {canEdit && (
        <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3 shadow-xl shadow-slate-200/50 dark:shadow-black/30">
          <p className="text-xs text-[var(--text-lo)]">{dirty ? "You have unsaved changes." : "All changes saved."}</p>
          <Button loading={saving} disabled={!dirty || saving} onClick={save}>Save changes</Button>
        </div>
      )}

      <SimpleModal open={confirmingDelete} onClose={() => !saving && setConfirmingDelete(false)} title="Delete this plan?" icon="solar:danger-triangle-broken" maxWidth="max-w-sm">
        <p className="text-sm leading-6 text-[var(--text-lo)]">
          &ldquo;{idp.title}&rdquo; and its action steps will be removed. This can&apos;t be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" disabled={saving} onClick={() => setConfirmingDelete(false)}>Cancel</Button>
          <Button variant="danger" loading={saving} icon="solar:trash-bin-minimalistic-broken" onClick={remove}>Delete plan</Button>
        </div>
      </SimpleModal>
    </div>
  );
}
