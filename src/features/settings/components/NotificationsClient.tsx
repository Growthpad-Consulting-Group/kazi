"use client";

import { useState, useTransition } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import SettingsSection from "./SettingsSection";
import { Button } from "@/components/ui/Button";
import { saveNotificationPrefs, type NotifPrefs } from "../actions";

interface Props {
  initial: NotifPrefs;
}

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--text-hi)]">{label}</p>
        {description && <p className="mt-0.5 text-xs text-[var(--text-lo)]">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f05d23]/50 ${checked ? "bg-[#f05d23]" : "bg-[var(--border)]"}`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${checked ? "translate-x-4" : "translate-x-0"}`}
        />
      </button>
    </div>
  );
}

const GROUPS: { title: string; icon: string; keys: (keyof NotifPrefs)[]; labels: Partial<Record<keyof NotifPrefs, { label: string; description?: string }>> }[] = [
  {
    title: "Check-ins",
    icon: "solar:calendar-mark-broken",
    keys: ["checkin_reminders", "checkin_submitted"],
    labels: {
      checkin_reminders: { label: "Check-in reminders", description: "Nudge before a scheduled check-in is due" },
      checkin_submitted: { label: "Check-in submitted", description: "When someone on your team submits a check-in" },
    },
  },
  {
    title: "Goals",
    icon: "solar:target-broken",
    keys: ["goal_due_soon", "goal_completed"],
    labels: {
      goal_due_soon: { label: "Goal due soon", description: "Alert 3 days before a goal deadline" },
      goal_completed: { label: "Goal completed", description: "When a goal you own or follow is marked complete" },
    },
  },
  {
    title: "Reviews",
    icon: "solar:diploma-broken",
    keys: ["review_cycle_started", "review_submitted"],
    labels: {
      review_cycle_started: { label: "Review cycle started", description: "When a new review cycle opens that includes you" },
      review_submitted: { label: "Review submitted", description: "When a review is submitted about you" },
    },
  },
  {
    title: "1-on-1s",
    icon: "solar:chat-round-dots-broken",
    keys: ["one_on_one_scheduled", "one_on_one_reminder"],
    labels: {
      one_on_one_scheduled: { label: "1-on-1 scheduled", description: "When a meeting is created with you" },
      one_on_one_reminder: { label: "1-on-1 reminder", description: "24-hour reminder before a scheduled 1-on-1" },
    },
  },
  {
    title: "Surveys",
    icon: "solar:checklist-broken",
    keys: ["survey_published"],
    labels: {
      survey_published: { label: "Survey published", description: "When a new survey you're invited to goes live" },
    },
  },
  {
    title: "System",
    icon: "solar:bell-broken",
    keys: ["system_announcements"],
    labels: {
      system_announcements: { label: "System announcements", description: "Important updates from your Kazi administrator" },
    },
  },
];

export default function NotificationsClient({ initial }: Props) {
  const [prefs, setPrefs] = useState<NotifPrefs>(initial);
  const [isPending, startTransition] = useTransition();

  const set = <K extends keyof NotifPrefs>(key: K, val: NotifPrefs[K]) =>
    setPrefs((p) => ({ ...p, [key]: val }));

  function save() {
    startTransition(async () => {
      try {
        await saveNotificationPrefs(prefs);
        toast.success("Notification preferences saved");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save preferences");
      }
    });
  }

  return (
    <div className="space-y-5">
      {GROUPS.map((group) => (
        <SettingsSection key={group.title} title={group.title} icon={group.icon}>
          <div className="divide-y divide-[var(--border)]">
            {group.keys.map((key) => {
              const meta = group.labels[key];
              if (!meta) return null;
              return (
                <Toggle
                  key={key}
                  checked={prefs[key]}
                  onChange={(v) => set(key, v)}
                  label={meta.label}
                  description={meta.description}
                />
              );
            })}
          </div>
        </SettingsSection>
      ))}

      <div className="flex justify-end">
        <Button icon="solar:diskette-broken" loading={isPending} onClick={save}>
          {isPending ? "Saving…" : "Save preferences"}
        </Button>
      </div>
    </div>
  );
}
