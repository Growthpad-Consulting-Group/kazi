import React from 'react';
import { Icon } from '@iconify/react';

interface FormActionsProps {
  onCancel: () => void;
  onSave?: (e: React.FormEvent) => void;
  loading?: boolean;
  disabled?: boolean;
  mode?: "light" | "dark";
  saveText?: string;
  cancelText?: string;
  showSave?: boolean;
  variant?: "primary" | "secondary" | "success" | "danger" | "warning";
  saveIcon?: string | null;
  cancelIcon?: string | null;
  size?: "small" | "default" | "large";
  layout?: "horizontal" | "vertical" | "reverse" | "page-footer";
  fullWidth?: boolean;
  className?: string;
}

const sizeClasses = { small: "px-3 py-1.5 text-xs", default: "px-4 py-2 text-sm", large: "px-5 py-2.5 text-sm" };
const variantClasses = {
  primary: "bg-[#f05d23] text-white hover:bg-[#d94f1a] focus:ring-[#f05d23]/50",
  secondary: "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50",
  success: "bg-[#f05d23] text-white hover:bg-[#d94f1a] focus:ring-[#f05d23]/50",
  danger: "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100",
  warning: "border border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100",
};
const layoutClasses = {
  horizontal: "grid grid-cols-1 sm:grid-cols-2 gap-3",
  vertical: "flex flex-col gap-3",
  reverse: "grid grid-cols-1 sm:grid-cols-2 gap-3",
  "page-footer": "flex flex-col sm:flex-row sm:justify-end gap-3",
};

export default function FormActions({ onCancel, onSave, loading = false, disabled = false, saveText = "Save", cancelText = "Cancel", showSave = true, variant = "primary", saveIcon = null, cancelIcon = null, size = "default", layout = "horizontal", fullWidth = true, className = "" }: FormActionsProps) {
  const isPageFooter = layout === "page-footer";
  const baseCancel = `rounded-lg font-medium border border-gray-200 dark:border-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 focus:ring-gray-300/50 disabled:opacity-50 disabled:cursor-not-allowed ${fullWidth ? (isPageFooter ? "w-full sm:w-auto" : "w-full") : ""} ${sizeClasses[size]}`;
  const baseSave = `rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${fullWidth ? (isPageFooter ? "w-full sm:w-auto" : "w-full") : ""} ${sizeClasses[size]} ${variantClasses[variant]}`;

  const cancelBtn = (
    <button type="button" onClick={onCancel} disabled={loading} className={baseCancel}>
      <div className="flex items-center justify-center gap-2">
        {cancelIcon && <Icon icon={cancelIcon} className="w-4 h-4" />}
        <span>{cancelText}</span>
      </div>
    </button>
  );

  const saveBtn = showSave ? (
    <button type="button" onClick={(e) => { e.preventDefault(); if (!loading && onSave) onSave(e); }} disabled={loading || disabled} className={baseSave}>
      <div className="flex items-center justify-center gap-2">
        {loading ? <Icon icon="solar:wheel-angle-broken" className="animate-spin w-4 h-4" /> : saveIcon ? <Icon icon={saveIcon} className="w-4 h-4" /> : null}
        <span>{saveText}</span>
      </div>
    </button>
  ) : <div />;

  return (
    <div className={`${layoutClasses[layout]} ${className}`}>
      {layout === "reverse" ? <>{saveBtn}{cancelBtn}</> : <>{cancelBtn}{saveBtn}</>}
    </div>
  );
}
