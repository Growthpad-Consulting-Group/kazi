import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { Icon } from "@iconify/react";
import SetPageHeader from "@/components/ui/SetPageHeader";
import SettingsSection from "./SettingsSection";

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
  if (!session || !can(session.user.role, "manage_system")) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <SetPageHeader title="Data Exports" description="Download records as CSV for offline reporting" icon="solar:download-minimalistic-broken" />

      <SettingsSection title="Exports" description="Generated on click, downloaded straight to your device" icon="solar:download-broken">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {EXPORTS.map(({ label, description, href, icon }) => (
            <a
              key={label}
              href={href}
              download
              className="group flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-5 shadow-sm hover:shadow-md transition-all duration-200 hover:bg-brand-500/5"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 transition-colors group-hover:bg-brand-500/15">
                <Icon icon={icon} className="h-4.5 w-4.5 text-brand-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-hi)]">{label}</p>
                <p className="mt-0.5 text-xs text-[var(--text-lo)]">{description}</p>
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
