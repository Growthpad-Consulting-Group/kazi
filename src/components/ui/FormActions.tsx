import React from "react";
import { Icon } from "@iconify/react";

interface FormActionsProps {
  onCancel: () => void;
  onSave?: () => void;
  loading?: boolean;
  disabled?: boolean;
  saveText?: string;
  cancelText?: string;
  saveIcon?: string | null;
  cancelIcon?: string | null;
  layout?: "horizontal" | "vertical" | "page-footer";
  fullWidth?: boolean;
  className?: string;
}

const LAYOUT_CLASSES: Record<NonNullable<FormActionsProps["layout"]>, string> = {
  horizontal: "grid grid-cols-1 gap-3 sm:grid-cols-2",
  vertical: "flex flex-col gap-3",
  "page-footer": "flex flex-col gap-3 sm:flex-row sm:justify-end",
};

/**
 * Cancel/Save button pair used on form pages — stacked in a sticky sidebar
 * on desktop (layout="vertical"), fixed bottom bar on mobile (layout="page-footer").
 * Ported from bflowpos, restyled for Kazi's design tokens.
 */
export default function FormActions({
  onCancel,
  onSave,
  loading = false,
  disabled = false,
  saveText = "Save",
  cancelText = "Cancel",
  saveIcon = null,
  cancelIcon = null,
  layout = "horizontal",
  fullWidth = true,
  className = "",
}: FormActionsProps) {
  const isPageFooter = layout === "page-footer";
  const width = fullWidth ? (isPageFooter ? "w-full sm:w-auto" : "w-full") : "";

  const cancelClasses = `inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--text-lo)] transition-all hover:bg-[var(--surface-2)] hover:text-[var(--text-hi)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${width}`;

  const saveClasses = `inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 ${width}`;

  return (
    <div className={`${LAYOUT_CLASSES[layout]} ${className}`}>
      <button type="button" onClick={onCancel} disabled={loading} className={cancelClasses}>
        {cancelIcon && <Icon icon={cancelIcon} className="h-4 w-4" />}
        <span>{cancelText}</span>
      </button>
      <button
        type="button"
        onClick={() => {
          if (!loading && !disabled && onSave) onSave();
        }}
        disabled={loading || disabled}
        className={saveClasses}
      >
        {loading ? (
          <Icon icon="solar:wheel-angle-broken" className="h-4 w-4 animate-spin" />
        ) : (
          saveIcon && <Icon icon={saveIcon} className="h-4 w-4" />
        )}
        <span>{saveText}</span>
      </button>
    </div>
  );
}
