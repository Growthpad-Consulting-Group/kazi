"use client";

import { useState } from "react";
import { DatePicker } from "@/components/ui/DatePicker";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import type { Goal, GoalLevel } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";

const LEVELS: GoalLevel[] = ["company", "team", "individual"];

export function GoalActions({ goal }: { goal: Goal }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(goal.title);
  const [description, setDescription] = useState(goal.description ?? "");
  const [level, setLevel] = useState<GoalLevel>(goal.level);
  const [dueDate, setDueDate] = useState(goal.due_date ?? "");

  const openEdit = () => {
    setTitle(goal.title);
    setDescription(goal.description ?? "");
    setLevel(goal.level);
    setDueDate(goal.due_date ?? "");
    setEditing(true);
  };

  async function saveEdit() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/pulse/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          level,
          due_date: dueDate || null,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) throw new Error(json?.error ?? "Could not save the goal");
      setEditing(false);
      toast.success("Goal updated");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save the goal",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      const res = await fetch(`/api/pulse/goals/${goal.id}`, {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) throw new Error(json?.error ?? "Could not delete the goal");
      setConfirmingDelete(false);
      toast.success("Goal deleted");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not delete the goal",
      );
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-hi)] outline-none placeholder:text-[var(--text-lo)] focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10";

  return (
    <>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={openEdit}
          aria-label="Edit goal"
          title="Edit goal"
          className="rounded-lg p-1.5 text-[var(--text-lo)] transition-colors hover:bg-[var(--surface-2)] hover:text-brand-500"
        >
          <Icon icon="solar:pen-broken" className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          aria-label="Delete goal"
          title="Delete goal"
          className="rounded-lg p-1.5 text-[var(--text-lo)] transition-colors hover:bg-red-500/10 hover:text-red-500"
        >
          <Icon
            icon="solar:trash-bin-minimalistic-broken"
            className="h-3.5 w-3.5"
          />
        </button>
      </div>

      <SimpleModal
        open={editing}
        onClose={() => !saving && setEditing(false)}
        title="Edit goal"
        icon="solar:pen-broken"
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
              Goal title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
              Description{" "}
              <span className="font-normal text-[var(--text-lo)]">
                Optional
              </span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${inputClass} resize-y`}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
                Scope
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as GoalLevel)}
                className={inputClass}
              >
                {LEVELS.map((item) => (
                  <option key={item} value={item} className="capitalize">
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
                Due date{" "}
                <span className="font-normal text-[var(--text-lo)]">
                  Optional
                </span>
              </label>
              <DatePicker
                value={dueDate}
                onChange={setDueDate}
                className="w-full"
              />
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button variant="secondary" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button
            icon="solar:diskette-broken"
            loading={saving}
            disabled={saving || !title.trim()}
            onClick={saveEdit}
          >
            Save changes
          </Button>
        </div>
      </SimpleModal>

      <SimpleModal
        open={confirmingDelete}
        onClose={() => !saving && setConfirmingDelete(false)}
        title="Delete goal?"
        icon="solar:danger-triangle-broken"
        maxWidth="max-w-sm"
      >
        <p className="text-sm leading-6 text-[var(--text-lo)]">
          &ldquo;{goal.title}&rdquo; will be removed. Any goals linked under it
          stay in place as top-level goals.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => setConfirmingDelete(false)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={saving}
            icon="solar:trash-bin-minimalistic-broken"
            onClick={remove}
          >
            Delete goal
          </Button>
        </div>
      </SimpleModal>
    </>
  );
}
