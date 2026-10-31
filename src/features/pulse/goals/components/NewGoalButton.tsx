"use client";

import { useState } from "react";
import { DatePicker } from "@/components/ui/DatePicker";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import type { GoalLevel, UserRole } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";

const LEVELS: GoalLevel[] = ["company", "team", "individual"];
const LEVEL_META: Record<GoalLevel, { icon: string; description: string }> = {
  company: {
    icon: "solar:buildings-2-broken",
    description: "A shared organisational outcome",
  },
  team: {
    icon: "solar:users-group-two-rounded-broken",
    description: "A function or squad commitment",
  },
  individual: {
    icon: "solar:user-rounded-broken",
    description: "A personal performance outcome",
  },
};

export function NewGoalButton({
  userId,
  role,
  owners,
  parentGoals,
  size = "md",
}: {
  userId: string;
  role: UserRole;
  owners: { id: string; name: string }[];
  parentGoals: { id: string; title: string; level: GoalLevel }[];
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState<GoalLevel>("individual");
  const [ownerId, setOwnerId] = useState(userId);
  const [parentId, setParentId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [targetUnit, setTargetUnit] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const allowedLevels = LEVELS.filter((item) => {
    if (role === "admin" || role === "hr") return true;
    if (role === "manager") return item !== "company";
    return item === "individual";
  });
  const eligibleParents = parentGoals.filter((goal) => {
    if (level === "team") return goal.level === "company";
    if (level === "individual") return goal.level !== "individual";
    return false;
  });

  async function submit() {
    if (!title.trim()) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/pulse/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          level,
          owner_id: level === "individual" ? ownerId : null,
          parent_id: parentId || null,
          due_date: dueDate || null,
          target_value: targetValue ? Number(targetValue) : null,
          current_value: currentValue ? Number(currentValue) : null,
          target_unit: targetUnit || null,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok)
        throw new Error(data?.error ?? "Could not create goal.");
      setOpen(false);
      setTitle("");
      setDescription("");
      setLevel("individual");
      setOwnerId(userId);
      setParentId("");
      setDueDate("");
      setTargetValue("");
      setCurrentValue("");
      setTargetUnit("");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not create goal.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        size={size}
        icon="solar:add-circle-broken"
        onClick={() => setOpen(true)}
      >
        {role === "employee" ? "New personal goal" : "New goal"}
      </Button>
      <SimpleModal
        open={open}
        onClose={() => setOpen(false)}
        title="Create a goal"
        icon="solar:target-broken"
        maxWidth="max-w-lg"
      >
        <p className="text-sm text-[var(--text-lo)]">
          Write an outcome, then give it a clear finish line.
        </p>

        <div className="mt-5 space-y-4">
          <fieldset>
            <legend className="text-xs font-semibold text-[var(--text-hi)]">
              Scope
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {allowedLevels.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setLevel(item);
                    setParentId("");
                  }}
                  className={`rounded-xl border p-3 text-left transition-colors ${level === item ? "border-brand-500/35 bg-brand-500/[0.06]" : "border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface)]"}`}
                >
                  <Icon
                    icon={LEVEL_META[item].icon}
                    className={`h-5 w-5 ${level === item ? "text-brand-500" : "text-[var(--text-lo)]"}`}
                  />
                  <span className="mt-2 block text-sm font-semibold capitalize text-[var(--text-hi)]">
                    {item}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-[var(--text-lo)]">
                    {LEVEL_META[item].description}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          {level === "individual" && (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[var(--text-hi)]">
                Owner
              </label>
              {owners.length === 1 ? (
                <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-hi)]">
                  {owners[0]?.name}
                </p>
              ) : (
                <select
                  value={ownerId}
                  onChange={(event) => setOwnerId(event.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10"
                >
                  {owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {eligibleParents.length > 0 && (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[var(--text-hi)]">
                Align to a parent goal{" "}
                <span className="font-normal text-[var(--text-lo)]">
                  Optional
                </span>
              </label>
              <select
                value={parentId}
                onChange={(event) => setParentId(event.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10"
              >
                <option value="">No parent goal</option>
                {eligibleParents.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.level === "company" ? "Company" : "Team"}:{" "}
                    {goal.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[var(--text-hi)]">
              Goal title
            </label>
            <input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Improve customer onboarding completion"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-hi)] outline-none placeholder:text-[var(--text-lo)] focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[var(--text-hi)]">
              Measurable outcome{" "}
              <span className="font-normal text-[var(--text-lo)]">
                Optional
              </span>
            </label>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1.2fr]">
              <input
                type="number"
                min="0.01"
                step="any"
                value={targetValue}
                onChange={(event) => setTargetValue(event.target.value)}
                placeholder="Target"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-hi)] outline-none placeholder:text-[var(--text-lo)] focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10"
              />
              <input
                type="number"
                min="0"
                step="any"
                value={currentValue}
                onChange={(event) => setCurrentValue(event.target.value)}
                placeholder="Current"
                disabled={!targetValue}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-hi)] outline-none placeholder:text-[var(--text-lo)] disabled:cursor-not-allowed disabled:opacity-50 focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10"
              />
              <input
                value={targetUnit}
                onChange={(event) => setTargetUnit(event.target.value)}
                maxLength={40}
                placeholder="Unit, e.g. clients"
                disabled={!targetValue}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-hi)] outline-none placeholder:text-[var(--text-lo)] disabled:cursor-not-allowed disabled:opacity-50 focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10"
              />
            </div>
            <p className="mt-1.5 text-xs text-[var(--text-lo)]">
              Progress is calculated from the current value and target.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[var(--text-hi)]">
              Description{" "}
              <span className="font-normal text-[var(--text-lo)]">
                Optional
              </span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What does success look like?"
              className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-hi)] outline-none placeholder:text-[var(--text-lo)] focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[var(--text-hi)]">
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

          {error && <p className="text-xs font-medium text-red-500">{error}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            icon="solar:check-circle-broken"
            loading={saving}
            disabled={
              saving || !title.trim() || (level === "individual" && !ownerId)
            }
            onClick={submit}
          >
            {saving ? "Creating" : "Create goal"}
          </Button>
        </div>
      </SimpleModal>
    </>
  );
}
