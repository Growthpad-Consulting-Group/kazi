"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import DateRangePicker from "@/components/ui/DateRangePicker";
import { SimpleModal } from "@/components/ui/SimpleModal";
import type { Pip } from "@/types/database";

type Action = { text: string; due_date: string | null; done: boolean };
type Outcome = "successful" | "unsuccessful";

interface Props {
  pip: Pip;
  employeeName: string;
  canEdit: boolean;
  isEmployee: boolean;
}

const CHECK_IN_OPTIONS = ["Daily", "Weekly", "Fortnightly", "Monthly"];
const inputClass = "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60";
const sectionClass = "space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 dark:shadow-black/20 sm:p-6";

function toDateValue(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

export function PipDetail({ pip, employeeName, canEdit, isEmployee }: Props) {
  const router = useRouter();
  const [concern, setConcern] = useState(pip.concern);
  const [expected, setExpected] = useState(pip.expected_outcomes);
  const [support, setSupport] = useState(pip.support_provided ?? "");
  const [checkIn, setCheckIn] = useState(pip.check_in_frequency ?? "Weekly");
  const [startDate, setStartDate] = useState(pip.start_date);
  const [reviewDate, setReviewDate] = useState(pip.review_date ?? "");
  const [actions, setActions] = useState<Action[]>(pip.actions ?? []);
  const [newAction, setNewAction] = useState("");
  const [newDue, setNewDue] = useState("");
  const [saving, setSaving] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [notes, setNotes] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isResolved = Boolean(pip.resolved_at);
  const done = actions.filter((action) => action.done).length;
  const progress = actions.length ? Math.round((done / actions.length) * 100) : 0;
  const dirty =
    concern !== pip.concern ||
    expected !== pip.expected_outcomes ||
    support !== (pip.support_provided ?? "") ||
    checkIn !== (pip.check_in_frequency ?? "Weekly") ||
    startDate !== pip.start_date ||
    reviewDate !== (pip.review_date ?? "") ||
    JSON.stringify(actions) !== JSON.stringify(pip.actions ?? []);

  async function send(body: unknown, success: string) {
    setSaving(true);
    try {
      const response = await fetch(`/api/pulse/pips/${pip.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Something went wrong.");
      toast.success(success);
      router.refresh();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (reviewDate && reviewDate < startDate) {
      toast.error("The review date must be on or after the start date.");
      return;
    }
    await send({ concern, expected_outcomes: expected, support_provided: support, check_in_frequency: checkIn, start_date: startDate, review_date: reviewDate || null, actions }, "Plan saved");
  }

  async function saveActions() {
    await send({ actions }, "Progress saved");
  }

  async function resolve() {
    if (!outcome) return;
    const ok = await send({ resolve: { outcome, notes } }, "Plan closed");
    if (ok) setResolveOpen(false);
  }

  async function reopen() {
    await send({ reopen: true }, "Plan reopened");
  }

  async function remove() {
    setSaving(true);
    try {
      const response = await fetch(`/api/pulse/pips/${pip.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(((await response.json().catch(() => null)) as { error?: string } | null)?.error ?? "Could not delete the plan.");
      toast.success("Plan deleted");
      router.push("/pulse/pips");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the plan.");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/50 dark:shadow-black/20 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-lo)]">Performance support plan</p>
            <h1 className="mt-1 truncate text-xl font-semibold text-[var(--text-hi)]">{employeeName}</h1>
            <p className="mt-1 text-xs text-[var(--text-lo)]">
              {formatDate(pip.start_date)} – {pip.review_date ? formatDate(pip.review_date) : "no review date"}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${isResolved ? (pip.outcome === "successful" ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-500") : "bg-amber-500/10 text-amber-700"}`}>
              {isResolved ? (pip.outcome === "successful" ? "Successful" : pip.outcome === "unsuccessful" ? "Unsuccessful" : "Closed") : "Active"}
            </span>
            {canEdit && !isResolved && <Button size="sm" variant="secondary" icon="solar:flag-broken" onClick={() => setResolveOpen(true)}>Close plan</Button>}
            {canEdit && isResolved && <Button size="sm" variant="secondary" icon="solar:restart-broken" loading={saving} onClick={reopen}>Reopen</Button>}
            {canEdit && <Button size="sm" variant="danger" icon="solar:trash-bin-minimalistic-broken" onClick={() => setConfirmingDelete(true)}>Delete</Button>}
          </div>
        </div>
        {isResolved && pip.resolution_notes && (
          <div className="mt-4 rounded-xl bg-[var(--surface-2)] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-lo)]">Closing notes</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-hi)]">{pip.resolution_notes}</p>
          </div>
        )}
      </section>

      <section className={sectionClass}>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-lo)]">Plan details</p>
        {canEdit ? (
          <>
            <label className="block text-xs font-semibold text-[var(--text-hi)]">Performance concern
              <textarea rows={3} value={concern} onChange={(e) => setConcern(e.target.value)} className={`${inputClass} mt-1.5 resize-y`} />
            </label>
            <label className="block text-xs font-semibold text-[var(--text-hi)]">Expected outcomes
              <textarea rows={3} value={expected} onChange={(e) => setExpected(e.target.value)} className={`${inputClass} mt-1.5 resize-y`} />
            </label>
            <label className="block text-xs font-semibold text-[var(--text-hi)]">Support provided
              <textarea rows={2} value={support} onChange={(e) => setSupport(e.target.value)} className={`${inputClass} mt-1.5 resize-y`} />
            </label>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
              <div>
                <p className="text-xs font-semibold text-[var(--text-hi)]">Plan window</p>
                <div className="mt-1.5">
                  <DateRangePicker
                    value={{ startDate: startDate ? new Date(`${startDate}T12:00:00`) : null, endDate: reviewDate ? new Date(`${reviewDate}T12:00:00`) : null }}
                    onChange={(range) => {
                      setStartDate(range.startDate ? toDateValue(range.startDate) : "");
                      setReviewDate(range.endDate ? toDateValue(range.endDate) : "");
                    }}
                    allowedRanges={["Custom Range"]}
                    maxDate={null}
                    fullWidth
                  />
                </div>
              </div>
              <label className="block text-xs font-semibold text-[var(--text-hi)]">Check-ins
                <select value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={`${inputClass} mt-1.5`}>
                  {CHECK_IN_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <Field label="Performance concern" value={pip.concern} />
            <Field label="Expected outcomes" value={pip.expected_outcomes} />
            <Field label="Support provided" value={pip.support_provided} />
            <Field label="Check-ins" value={pip.check_in_frequency ?? "Not set"} />
          </div>
        )}
      </section>

      <section className={sectionClass}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-lo)]">Action steps</p>
          {actions.length > 0 && <span className="font-mono text-[11px] text-[var(--text-lo)]">{done}/{actions.length} done · {progress}%</span>}
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
                disabled={isResolved}
                onClick={() => setActions(actions.map((item, i) => (i === index ? { ...item, done: !item.done } : item)))}
                aria-label={action.done ? "Mark not done" : "Mark done"}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors disabled:opacity-60 ${action.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-[var(--border)] bg-[var(--surface)]"}`}
              >
                {action.done && <Icon icon="solar:check-read-broken" className="h-3.5 w-3.5" />}
              </button>
              <span className={`min-w-0 flex-1 text-sm ${action.done ? "text-[var(--text-lo)] line-through" : "text-[var(--text-hi)]"}`}>{action.text}</span>
              {action.due_date && <span className="shrink-0 text-[11px] text-[var(--text-lo)]">{formatDate(action.due_date)}</span>}
              {canEdit && !isResolved && (
                <button type="button" onClick={() => setActions(actions.filter((_, i) => i !== index))} aria-label="Remove step" className="shrink-0 rounded p-0.5 text-[var(--text-lo)] hover:text-red-500">
                  <Icon icon="solar:close-circle-broken" className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
          {actions.length === 0 && <li className="rounded-xl bg-[var(--surface-2)] px-3 py-4 text-center text-xs text-[var(--text-lo)]">No action steps yet.</li>}
        </ul>
        {canEdit && !isResolved && (
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_200px_auto]">
            <input value={newAction} onChange={(e) => setNewAction(e.target.value)} onKeyDown={(e) => e.key === "Enter" && newAction.trim() && (setActions([...actions, { text: newAction.trim(), due_date: newDue || null, done: false }]), setNewAction(""), setNewDue(""))} placeholder="Add an action step…" className={inputClass} />
            <DatePicker value={newDue} onChange={setNewDue} placeholder="Step due date" />
            <Button variant="secondary" disabled={!newAction.trim()} onClick={() => { setActions([...actions, { text: newAction.trim(), due_date: newDue || null, done: false }]); setNewAction(""); setNewDue(""); }}>Add</Button>
          </div>
        )}
      </section>

      {(canEdit && dirty) && (
        <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3 shadow-xl shadow-slate-200/50 dark:shadow-black/30">
          <p className="text-xs text-[var(--text-lo)]">You have unsaved changes.</p>
          <Button loading={saving} onClick={save}>Save changes</Button>
        </div>
      )}
      {isEmployee && !canEdit && !isResolved && actions.length > 0 && (
        <div className="flex justify-end">
          <Button variant="secondary" loading={saving} onClick={saveActions}>Save progress</Button>
        </div>
      )}

      <SimpleModal open={resolveOpen} onClose={() => !saving && setResolveOpen(false)} title="Close this plan" icon="solar:flag-broken" maxWidth="max-w-md">
        <div className="space-y-4">
          <p className="text-xs text-[var(--text-lo)]">Record whether the expected outcomes were met. The plan will move to closed.</p>
          <div className="grid grid-cols-2 gap-2">
            {(["successful", "unsuccessful"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setOutcome(value)}
                className={`rounded-xl border p-3 text-left text-xs font-semibold transition-colors ${outcome === value ? "border-brand-500/40 bg-brand-500/[0.06] text-[var(--text-hi)]" : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-lo)]"}`}
              >
                {value === "successful" ? "Successful" : "Unsuccessful"}
              </button>
            ))}
          </div>
          <label className="block text-xs font-semibold text-[var(--text-hi)]">Closing notes <span className="font-normal text-[var(--text-lo)]">Optional</span>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} mt-1.5 resize-y`} />
          </label>
          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <Button variant="secondary" disabled={saving} onClick={() => setResolveOpen(false)}>Cancel</Button>
            <Button loading={saving} disabled={!outcome} onClick={resolve}>Close plan</Button>
          </div>
        </div>
      </SimpleModal>

      <SimpleModal open={confirmingDelete} onClose={() => !saving && setConfirmingDelete(false)} title="Delete this plan?" icon="solar:danger-triangle-broken" maxWidth="max-w-sm">
        <p className="text-sm leading-6 text-[var(--text-lo)]">This removes the plan and its action steps for good. Consider closing it instead to keep a record.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" disabled={saving} onClick={() => setConfirmingDelete(false)}>Cancel</Button>
          <Button variant="danger" loading={saving} onClick={remove}>Delete plan</Button>
        </div>
      </SimpleModal>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-lo)]">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-hi)]">{value || "Not set"}</p>
    </div>
  );
}
