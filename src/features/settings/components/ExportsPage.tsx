import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { isPathAllowed } from "@/lib/page-access";
import { can } from "@/lib/rbac";
import { Icon } from "@iconify/react";
import SetPageHeader from "@/components/ui/SetPageHeader";
import SettingsSection from "./SettingsSection";
import { ViewOnlyNotice } from "./EditableArea";

const EXPORTS = [
  {
    label: "Candidates",
    description: "All candidates with stage, AI score and job",
    href: "/api/export/candidates",
    icon: "solar:users-group-two-rounded-broken",
  },
  {
    label: "Employees",
    description: "Active and inactive employee roster",
    href: "/api/export/employees",
    icon: "solar:user-id-broken",
  },
  {
    label: "Reviews",
    description: "Performance review summaries by cycle",
    href: "/api/export/reviews",
    icon: "solar:diploma-broken",
  },
];

export default async function ExportsPage() {
  const session = await getServerSession(authOptions);
  if (
    !session ||
    !isPathAllowed(session.user.allowedPaths, "/settings/exports")
  )
    redirect("/settings/profile");
  const canEdit = can(session.user.role, "manage_system");

  return (
    <div className="space-y-6">
      <SetPageHeader
        title="Data Exports"
        description="Download records as CSV for offline reporting"
        icon="solar:download-minimalistic-broken"
      />

      {!canEdit && <ViewOnlyNotice permissionLabel="system settings" />}
      <SettingsSection
        title="Exports"
        description="Generated on click, downloaded straight to your device"
        icon="solar:download-broken"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {EXPORTS.map(({ label, description, href, icon }) => (
            <a
              key={label}
              href={canEdit ? href : undefined}
              download={canEdit || undefined}
              aria-disabled={!canEdit}
              tabIndex={canEdit ? undefined : -1}
              className={`group flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-5 shadow-sm transition-all duration-200 ${canEdit ? "hover:shadow-md hover:bg-brand-500/5" : "pointer-events-none opacity-50"}`}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 transition-colors group-hover:bg-brand-500/15">
                <Icon icon={icon} className="h-4.5 w-4.5 text-brand-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-hi)]">
                  {label}
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-lo)]">
                  {description}
                </p>
              </div>
              <div className="mt-auto flex items-center gap-1.5 text-xs font-medium text-brand-500">
                <Icon icon="solar:download-broken" className="h-3.5 w-3.5" />
                Download CSV
              </div>
            </a>
          ))}
        </div>
      </SettingsSection>
    </div>
  );
}
