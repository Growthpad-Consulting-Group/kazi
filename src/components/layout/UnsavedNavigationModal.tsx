"use client";

import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";
import { useUnsavedChanges } from "@/shared/contexts/UnsavedChangesContext";

export default function UnsavedNavigationModal() {
  const {
    message,
    navigationConfirmationOpen,
    cancelNavigation,
    discardAndNavigate,
  } = useUnsavedChanges();
  const timerRunning = message.toLowerCase().includes("timer");

  return (
    <SimpleModal
      open={navigationConfirmationOpen}
      onClose={cancelNavigation}
      title="Leave without saving?"
      subtitle="Your current work needs a decision first."
      icon="solar:danger-triangle-broken"
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        <p className="text-sm leading-6 text-[var(--text-lo)]">
          {timerRunning
            ? "Your activity draft has not been saved. The active timer will keep running, so you can return to it later."
            : `${message}. Any unsaved changes will be lost if you leave now.`}
        </p>
        <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
          <Icon
            icon="solar:info-circle-broken"
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>
            {timerRunning
              ? "Stop the timer before saving the day, or keep it running while you work elsewhere."
              : "Stay to save your changes, or leave and discard this draft."}
          </span>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={cancelNavigation}>
            Stay here
          </Button>
          <Button variant="danger" onClick={discardAndNavigate}>
            Leave without saving
          </Button>
        </div>
      </div>
    </SimpleModal>
  );
}
