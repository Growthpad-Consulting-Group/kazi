"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";
import StatCard from "@/components/ui/StatCard";
import type {
  AutomationRule,
  AutomationTrigger,
  AutomationAction,
} from "@/types/database";

const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--text-hi)] transition-all focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";

const TRIGGER_LABEL: Record<AutomationTrigger, string> = {
  milestone_anniversary: "Milestone anniversary",
  campaign_start: "Campaign starts",
  quest_ends_soon: "Quest ends soon",
  recognition_received: "Recognition received",
  daily_log_logged: "Daily log saved",
  daily_log_streak: "Daily log streak",
};
const ACTION_LABEL: Record<AutomationAction, string> = {
  send_notification: "Send notification",
  award_points: "Award points",
};

const TRIGGER_HELP: Record<AutomationTrigger, string> = {
  milestone_anniversary:
    "Runs on the staff member's work anniversary or service milestone.",
  campaign_start:
    "Runs when a recognition campaign begins for its selected audience.",
  quest_ends_soon:
    "Runs once when an eligible Side Quest is within 48 hours of closing.",
  recognition_received:
    "Runs immediately when a staff member receives recognition.",
  daily_log_logged:
    "Runs once per day when a staff member logs at least 15 minutes of work.",
  daily_log_streak:
    "Runs when a staff member logs five days in a row, and again at every further five-day run.",
};
const RECIPIENT_LABEL: Record<AutomationTrigger, string> = {
  milestone_anniversary: "the celebrating staff member",
  campaign_start: "eligible campaign staff",
  quest_ends_soon: "eligible Side Quest staff",
  recognition_received: "the recognised staff member",
  daily_log_logged: "the staff member who logged",
  daily_log_streak: "the staff member on the streak",
};
const TRIGGER_ICON: Record<AutomationTrigger, string> = {
  milestone_anniversary: "solar:cup-star-broken",
  campaign_start: "solar:flag-2-broken",
  quest_ends_soon: "solar:medal-ribbon-star-broken",
  recognition_received: "solar:heart-angle-broken",
  daily_log_logged: "solar:notebook-broken",
  daily_log_streak: "solar:fire-broken",
};

const TRIGGER_OPTIONS = (Object.keys(TRIGGER_LABEL) as AutomationTrigger[]).map(
  (value) => ({
    value,
    label: TRIGGER_LABEL[value],
  }),
);
const ACTION_OPTIONS = (Object.keys(ACTION_LABEL) as AutomationAction[]).map(
  (value) => ({
    value,
    label: ACTION_LABEL[value],
  }),
);

interface Props {
  initial: AutomationRule[];
  runSummaries: RuleRunSummary[];
}

type RuleRunSummary = { ruleId: string; lastRunAt: string; runCount: number };

function getRuleSentence(
  trigger: AutomationTrigger,
  action: AutomationAction,
  points?: number,
) {
  const actionText =
    action === "award_points"
      ? `award ${points || 50} points to ${RECIPIENT_LABEL[trigger]}`
      : `notify ${RECIPIENT_LABEL[trigger]}`;
  return `When ${TRIGGER_LABEL[trigger].toLowerCase()}, ${actionText}.`;
}

function relativeTime(value: string) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AutomationsClient({ initial, runSummaries }: Props) {
  const [rules, setRules] = useState(initial);
  const [modalOpen, setModalOpen] = useState(false);
  const [triggerType, setTriggerType] = useState<AutomationTrigger>(
    "milestone_anniversary",
  );
  const [actionType, setActionType] =
    useState<AutomationAction>("send_notification");
  const [points, setPoints] = useState("50");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [ruleToDelete, setRuleToDelete] = useState<AutomationRule | null>(null);
  const [deleting, setDeleting] = useState(false);

  const runSummaryByRule = new Map(
    runSummaries.map((summary) => [summary.ruleId, summary]),
  );
  const activeCount = rules.filter((rule) => rule.is_active).length;
  const totalRuns = runSummaries.reduce(
    (total, summary) => total + summary.runCount,
    0,
  );

  async function handleToggle(rule: AutomationRule) {
    setTogglingId(rule.id);
    try {
      const res = await fetch(`/api/pulse/automations/rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !rule.is_active }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not update rule.");
      setRules((prev) =>
        prev.map((r) =>
          r.id === rule.id ? { ...r, is_active: !r.is_active } : r,
        ),
      );
      toast.success(
        rule.is_active ? "Automation paused." : "Automation enabled.",
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not update rule.",
      );
    } finally {
      setTogglingId(null);
    }
  }

  async function handleCreate() {
    setSaving(true);
    try {
      const res = await fetch("/api/pulse/automations/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trigger_type: triggerType,
          action_type: actionType,
          config:
            actionType === "award_points" ? { points: Number(points) } : {},
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        rule?: AutomationRule;
      };
      if (!res.ok) throw new Error(data.error ?? "Could not create rule.");
      if (data.rule) setRules((prev) => [data.rule!, ...prev]);
      toast.success("Automation rule created.");
      setModalOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not create rule.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!ruleToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/pulse/automations/rules/${ruleToDelete.id}`,
        {
          method: "DELETE",
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not delete rule.");
      setRules((prev) => prev.filter((rule) => rule.id !== ruleToDelete.id));
      setRuleToDelete(null);
      toast.success("Automation rule deleted.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not delete rule.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          title="Active rules"
          value={activeCount}
          icon="solar:bolt-broken"
          color="orange"
          variant="inline"
          compact
        />
        <StatCard
          title="Paused"
          value={rules.length - activeCount}
          icon="solar:pause-circle-broken"
          color="slate"
          variant="inline"
          compact
        />
        <StatCard
          title="Actions delivered"
          value={totalRuns}
          icon="solar:check-circle-broken"
          color="green"
          variant="inline"
          compact
        />
      </div>
      <section className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/50 dark:shadow-black/20">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--text-hi)]">
              Automation rules
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-lo)]">
              Trigger notifications and rewards automatically.
            </p>
          </div>
          <Button
            size="sm"
            icon="solar:add-circle-broken"
            onClick={() => setModalOpen(true)}
          >
            New rule
          </Button>
        </div>

        {rules.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center px-5 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500">
              <Icon icon="solar:bolt-circle-broken" className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm font-semibold text-[var(--text-hi)]">
              No automations yet
            </p>
            <p className="mt-1 text-xs text-[var(--text-lo)]">
              Create a rule to automate notifications and rewards.
            </p>
          </div>
        ) : (
          <ul className="max-h-[560px] space-y-2 overflow-y-auto p-3">
            {rules.map((rule) => {
              const summary = runSummaryByRule.get(rule.id);
              const pointsForRule = Number(rule.config?.points) || 50;
              return (
                <li
                  key={rule.id}
                  className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 transition-colors hover:bg-[var(--surface-2)]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                    <Icon
                      icon={TRIGGER_ICON[rule.trigger_type]}
                      className="h-[18px] w-[18px]"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--text-hi)]">
                      {getRuleSentence(
                        rule.trigger_type,
                        rule.action_type,
                        pointsForRule,
                      )}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-lo)]">
                      <span>{TRIGGER_HELP[rule.trigger_type]}</span>
                      <span className="hidden h-1 w-1 rounded-full bg-[var(--text-lo)] sm:block" />
                      <span>
                        {summary
                          ? `${summary.runCount} action${summary.runCount === 1 ? "" : "s"} delivered · ${relativeTime(summary.lastRunAt)}`
                          : "Waiting for its first event"}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={togglingId === rule.id}
                    onClick={() => handleToggle(rule)}
                    aria-label={
                      rule.is_active ? "Pause automation" : "Enable automation"
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${rule.is_active ? "bg-brand-500" : "bg-[var(--border)]"}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${rule.is_active ? "translate-x-6" : "translate-x-1"}`}
                    />
                  </button>
                  <button
                    type="button"
                    title="Delete automation"
                    onClick={() => setRuleToDelete(rule)}
                    className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-500/10"
                  >
                    <Icon
                      icon="solar:trash-bin-minimalistic-broken"
                      className="h-4 w-4"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Create modal */}
      <SimpleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New automation rule"
        icon="solar:bolt-circle-broken"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
              Trigger
            </label>
            <select
              value={triggerType}
              onChange={(e) =>
                setTriggerType(e.target.value as AutomationTrigger)
              }
              className={inputCls}
            >
              {TRIGGER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-[var(--text-lo)]">
              {TRIGGER_HELP[triggerType]}
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
              Action
            </label>
            <select
              value={actionType}
              onChange={(e) =>
                setActionType(e.target.value as AutomationAction)
              }
              className={inputCls}
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {actionType === "award_points" && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
                Points to award
              </label>
              <input
                type="number"
                min="1"
                max="10000"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                className={inputCls}
              />
              <p className="mt-1.5 text-xs text-[var(--text-lo)]">
                Each eligible staff member receives this amount once per event.
              </p>
            </div>
          )}
          <div className="rounded-xl bg-brand-500/10 px-3.5 py-3 text-sm text-[var(--text-hi)]">
            <span className="font-semibold text-brand-600 dark:text-brand-400">
              Rule summary:{" "}
            </span>
            {getRuleSentence(triggerType, actionType, Number(points) || 50)}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button
            icon="solar:add-circle-broken"
            loading={saving}
            disabled={
              saving ||
              (actionType === "award_points" &&
                (!Number.isInteger(Number(points)) ||
                  Number(points) < 1 ||
                  Number(points) > 10_000))
            }
            onClick={handleCreate}
          >
            Create rule
          </Button>
        </div>
      </SimpleModal>

      <SimpleModal
        open={!!ruleToDelete}
        onClose={() => setRuleToDelete(null)}
        title="Delete automation rule"
        icon="solar:trash-bin-minimalistic-broken"
        maxWidth="max-w-md"
      >
        <p className="text-sm text-[var(--text-lo)]">
          Delete this rule? It will stop running immediately and cannot be
          restored.
        </p>
        <div className="mt-5 flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button variant="secondary" onClick={() => setRuleToDelete(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            icon="solar:trash-bin-minimalistic-broken"
            loading={deleting}
            onClick={handleDelete}
          >
            Delete rule
          </Button>
        </div>
      </SimpleModal>
    </>
  );
}
