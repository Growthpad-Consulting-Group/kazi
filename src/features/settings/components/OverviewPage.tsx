import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import SetPageHeader from "@/components/ui/SetPageHeader";
import SettingsSection from "./SettingsSection";

export default async function OverviewPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const [{ count: people }, { count: jobs }, { count: candidates }, { count: departments }] =
    await Promise.all([
      supabaseAdmin.from("users").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("jobs").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("candidates").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("departments").select("id", { count: "exact", head: true }),
    ]);

  const initials =
    session.user.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "?";

  const stats = [
    { label: "Staff", value: people ?? 0 },
    { label: "Departments", value: departments ?? 0 },
    { label: "Jobs", value: jobs ?? 0 },
    { label: "Candidates", value: candidates ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <SetPageHeader title="Company & System" description="Organization details and platform information" icon="solar:shop-2-broken" />

      <SettingsSection title="Account" description="Your profile and access" icon="solar:user-circle-broken">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f05d23] to-[#d94f1e] text-lg font-bold text-white shadow-md">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-[var(--text-hi)]">{session.user.name}</p>
            <p className="truncate text-sm text-[var(--text-lo)]">{session.user.email}</p>
            <span className="mt-1 inline-flex items-center rounded-full bg-[#f05d23]/10 px-2.5 py-0.5 text-xs font-medium capitalize text-[#f05d23]">
              {session.user.role.replace("_", " ")}
            </span>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Organization" description="Current record counts" icon="solar:chart-square-broken" iconBg="bg-blue-500/10 text-blue-500">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
              <p className="font-mono text-2xl font-bold text-[var(--text-hi)]">{value.toLocaleString()}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-lo)]">{label}</p>
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="System" description="Platform information" icon="solar:info-circle-broken" iconBg="bg-blue-500/10 text-blue-500">
        <div className="divide-y divide-[var(--border)]">
          {[
            { label: "Platform", value: "Kazi by Growthpad" },
            { label: "Region", value: "Africa (Nairobi + Accra)" },
            { label: "Compliance", value: "ODPC Kenya · GDPR-aligned" },
            { label: "Data residency", value: "Supabase EU-West" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <span className="text-xs text-[var(--text-lo)]">{label}</span>
              <span className="text-xs font-medium text-[var(--text-hi)]">{value}</span>
            </div>
          ))}
        </div>
      </SettingsSection>
    </div>
  );
}
