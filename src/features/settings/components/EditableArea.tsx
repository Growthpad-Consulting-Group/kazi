import { Icon } from "@iconify/react";

/**
 * Wraps a settings section. When the role can open the page but not change it, the
 * native disabled fieldset turns off every input and button inside it.
 */
export function EditableArea({ canEdit, children }: { canEdit: boolean; children: React.ReactNode }) {
  return (
    <fieldset disabled={!canEdit} className="m-0 min-w-0 border-0 p-0">
      {children}
    </fieldset>
  );
}

export function ViewOnlyNotice({ permissionLabel }: { permissionLabel: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
        <Icon icon="solar:eye-broken" className="h-4 w-4" />
      </span>
      <div>
        <p className="text-sm font-semibold text-[var(--text-hi)]">View only</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--text-lo)]">You can see this page but not change it. Changing it needs the {permissionLabel} permission.</p>
      </div>
    </div>
  );
}
