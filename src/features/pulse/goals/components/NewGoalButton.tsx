"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import type { GoalLevel } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";

const LEVELS: GoalLevel[] = ["company", "team", "individual"];
const LEVEL_META: Record<GoalLevel, { icon: string; description: string }> = {
  company: { icon: "solar:buildings-2-broken", description: "A shared organisational outcome" },
  team: { icon: "solar:users-group-two-rounded-broken", description: "A function or squad commitment" },
  individual: { icon: "solar:user-rounded-broken", description: "A personal performance outcome" },
};

export function NewGoalButton({ userId, size = "md" }: { userId: string; size?: "sm" | "md" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState<GoalLevel>("individual");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!title.trim()) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/pulse/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, level, due_date: dueDate || null, created_by: userId }),
      });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Could not create goal.");
      setOpen(false);
      setTitle("");
      setDescription("");
      setLevel("individual");
      setDueDate("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create goal.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size={size} icon="solar:add-circle-broken" onClick={() => setOpen(true)}>
        New goal
      </Button>
      <SimpleModal
        open={open}
        onClose={() => setOpen(false)}
        title="Create a goal"
        icon="solar:target-broken"
        maxWidth="max-w-lg"
      >
        <p className="text-sm text-[var(--text-lo)]">Write an outcome, then give it a clear finish line.</p>

        <div className="mt-5 space-y-4">
          <fieldset>
            <legend className="text-xs font-semibold text-[var(--text-hi)]">Scope</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {LEVELS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setLevel(item)}
                  className={`rounded-xl border p-3 text-left transition-colors ${level === item ? "border-brand-500/35 bg-brand-500/[0.06]" : "border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface)]"}`}
                >
                  <Icon icon={LEVEL_META[item].icon} className={`h-4 w-4 ${level === item ? "text-brand-500" : "text-[var(--text-lo)]"}`} />
                  <span className="mt-2 block text-xs font-semibold capitalize text-[var(--text-hi)]">{item}</span>
                  <span className="mt-1 block text-[10px] leading-relaxed text-[var(--text-lo)]">{LEVEL_META[item].description}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">Goal title</label>
            <input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Improve customer onboarding completion"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-hi)] outline-none placeholder:text-[var(--text-lo)] focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">Description <span className="font-normal text-[var(--text-lo)]">Optional</span></label>
            <textarea
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What does success look like?"
              className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-hi)] outline-none placeholder:text-[var(--text-lo)] focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">Due date <span className="font-normal text-[var(--text-lo)]">Optional</span></label>
            <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500/60" />
          </div>

          {error && <p className="text-xs font-medium text-red-500">{error}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button icon="solar:check-circle-broken" loading={saving} disabled={saving || !title.trim()} onClick={submit}>
            {saving ? "Creating" : "Create goal"}
          </Button>
        </div>
      </SimpleModal>
    </>
  );
}
