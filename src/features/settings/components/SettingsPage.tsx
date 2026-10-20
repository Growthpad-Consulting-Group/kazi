import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import Link from "next/link";
import { Icon } from "@iconify/react";
import SetPageHeader from "@/components/ui/SetPageHeader";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const isHr = hasRole(session.user.role, "hr");

  const initials = session.user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?";

  return (
    <div className="space-y-6">
      <SetPageHeader
        title="Settings"
        description="System administration, compliance tools, and account preferences"
        icon="solar:settings-broken"
      />

      {isHr && (
        <>
          {/* Data Exports */}
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-lg shadow-black/5">
            <div className="flex items-center gap-3 border-b border-[var(--border)] px-6 py-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#f05d23]/10">
                <Icon icon="solar:download-broken" className="h-4 w-4 text-[#f05d23]" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-hi)]">Data Exports</h2>
                <p className="text-xs text-[var(--text-lo)]">Download records as CSV for offline reporting</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-0 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)]">
              <ExportCard
                label="Candidates"
                description="All candidates with stage, AI score and job"
                href="/api/export/candidates"
                icon="solar:users-group-two-rounded-broken"
              />
              <ExportCard
                label="Employees"
                description="Active and inactive employee roster"
                href="/api/export/employees"
                icon="solar:user-id-broken"
              />
              <ExportCard
                label="Reviews"
                description="Performance review summaries by cycle"
                href="/api/export/reviews"
                icon="solar:diploma-broken"
              />
            </div>
          </section>

          {/* Compliance */}
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-lg shadow-black/5">
            <div className="flex items-center gap-3 border-b border-[var(--border)] px-6 py-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10">
                <Icon icon="solar:shield-check-broken" className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-hi)]">Compliance</h2>
                <p className="text-xs text-[var(--text-lo)]">Data protection and retention management</p>
              </div>
            </div>
            <div className="p-6">
              <Link
                href="/settings/data-retention"
                className="flex items-center justify-between rounded-xl border border-amber-200/70 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-800/40 p-5 hover:bg-amber-100/60 dark:hover:bg-amber-900/20 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
                    <Icon icon="solar:trash-bin-minimalistic-broken" className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Candidate Data Retention</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                      Review and delete stale records — ODPC / Kenya Data Protection Act compliance
                    </p>
                  </div>
                </div>
                <Icon icon="solar:alt-arrow-right-broken" className="h-5 w-5 text-amber-400 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </section>
        </>
      )}

      {/* Account */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-lg shadow-black/5">
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-6 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#f05d23]/10">
            <Icon icon="solar:user-circle-broken" className="h-4 w-4 text-[#f05d23]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-hi)]">Account</h2>
            <p className="text-xs text-[var(--text-lo)]">Your profile and access details</p>
          </div>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f05d23] to-[#d94f1e] text-white font-bold text-lg shadow-md">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-[var(--text-hi)]">{session.user.name}</p>
              <p className="text-sm text-[var(--text-lo)] truncate">{session.user.email}</p>
              <span className="mt-1 inline-flex items-center rounded-full bg-[#f05d23]/10 px-2.5 py-0.5 text-xs font-medium text-[#f05d23] capitalize">
                {session.user.role.replace("_", " ")}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* System Info */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-lg shadow-black/5">
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-6 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10">
            <Icon icon="solar:info-circle-broken" className="h-4 w-4 text-blue-500" />
          </div>
          <h2 className="text-sm font-semibold text-[var(--text-hi)]">System</h2>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {[
            { label: "Platform", value: "Kazi by Growthpad" },
            { label: "Region", value: "Africa (Nairobi + Accra)" },
            { label: "Compliance", value: "ODPC Kenya · GDPR-aligned" },
            { label: "Data residency", value: "Supabase EU-West" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between px-6 py-3.5">
              <span className="text-xs text-[var(--text-lo)]">{label}</span>
              <span className="text-xs font-medium text-[var(--text-hi)]">{value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ExportCard({
  label,
  description,
  href,
  icon,
}: {
  label: string;
  description: string;
  href: string;
  icon: string;
}) {
  return (
    <a
      href={href}
      download
      className="group flex flex-col gap-3 p-6 hover:bg-[var(--surface-2)] transition-colors"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f05d23]/10 group-hover:bg-[#f05d23]/15 transition-colors">
        <Icon icon={icon} className="h-4.5 w-4.5 text-[#f05d23]" />
      </div>
      <div>
        <p className="text-sm font-semibold text-[var(--text-hi)]">{label}</p>
        <p className="text-xs text-[var(--text-lo)] mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-1.5 text-xs font-medium text-[#f05d23] mt-auto">
        <Icon icon="solar:download-broken" className="h-3.5 w-3.5" />
        Download CSV
      </div>
    </a>
  );
}
