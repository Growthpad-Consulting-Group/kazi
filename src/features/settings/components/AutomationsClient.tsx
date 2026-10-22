"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";
import type { AutomationRule, AutomationTrigger, AutomationAction } from "@/types/database";

const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--text-hi)] transition-all focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";

const TRIGGER_LABEL: Record<AutomationTrigger, string> = {
  milestone_anniversary: "Milestone anniversary",
  campaign_start: "Campaign starts",
  quest_ends_soon: "Quest ends soon",
  recognition_received: "Recognition received",
};
const ACTION_LABEL: Record<AutomationAction, string> = {
  send_notification: "Send notification",
  award_points: "Award points",
};

const TRIGGER_OPTIONS = (Object.keys(TRIGGER_LABEL) as AutomationTrigger[]).map((value) => ({
  value,
  label: TRIGGER_LABEL[value],
}));
const ACTION_OPTIONS = (Object.keys(ACTION_LABEL) as AutomationAction[]).map((value) => ({
  value,
  label: ACTION_LABEL[value],
}));

interface Props {
  initial: AutomationRule[];
}

export default function AutomationsClient({ initial }: Props) {
  const router = useRouter();
  const [rules, setRules] = useState(initial);
  const [modalOpen, setModalOpen] = useState(false);
  const [triggerType, setTriggerType] = useState<AutomationTrigger>("milestone_anniversary");
  const [actionType, setActionType] = useState<AutomationAction>("send_notification");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

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
        prev.map((r) => (r.id === rule.id ? { ...r, is_active: !r.is_active } : r)),
      );
      toast.success(rule.is_active ? "Automation paused." : "Automation enabled.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update rule.");
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
        body: JSON.stringify({ trigger_type: triggerType, action_type: actionType }),
      });
      const data = (await res.json()) as { error?: string; id?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not create rule.");
      toast.success("Automation rule created.");
      setModalOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create rule.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/50 dark:shadow-black/20">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--text-hi)]">Automation rules</p>
            <p className="mt-0.5 text-xs text-[var(--text-lo)]">
              Trigger notifications and rewards automatically.
            </p>
          </div>
          <Button size="sm" icon="solar:add-circle-broken" onClick={() => setModalOpen(true)}>
            New rule
          </Button>
        </div>

        {rules.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center px-5 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500">
              <Icon icon="solar:bolt-circle-broken" className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm font-semibold text-[var(--text-hi)]">No automations yet</p>
            <p className="mt-1 text-xs text-[var(--text-lo)]">
              Create a rule to automate notifications and rewards.
            </p>
          </div>
        ) : (
          <ul className="max-h-[480px] divide-y divide-[var(--border)] overflow-y-auto">
            {rules.map((rule) => (
              <li
                key={rule.id}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-2)]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                  <Icon icon="solar:bolt-broken" className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--text-hi)]">
                    {TRIGGER_LABEL[rule.trigger_type] ?? rule.trigger_type}
                    <span className="text-[var(--text-lo)]"> &rarr; </span>
                    {ACTION_LABEL[rule.action_type] ?? rule.action_type}
                  </p>
                  <p className="text-xs text-[var(--text-lo)]">
                    {rule.is_active ? "Active" : "Paused"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={togglingId === rule.id}
                  onClick={() => handleToggle(rule)}
                  aria-label={rule.is_active ? "Pause automation" : "Enable automation"}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${rule.is_active ? "bg-brand-500" : "bg-[var(--border)]"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${rule.is_active ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </li>
            ))}
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
            <label className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">Trigger</label>
            <select
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value as AutomationTrigger)}
              className={inputCls}
            >
              {TRIGGER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">Action</label>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value as AutomationAction)}
              className={inputCls}
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button icon="solar:add-circle-broken" loading={saving} disabled={saving} onClick={handleCreate}>
            Create rule
          </Button>
        </div>
      </SimpleModal>
    </>
  );
}
