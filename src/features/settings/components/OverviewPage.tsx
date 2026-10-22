import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import SetPageHeader from "@/components/ui/SetPageHeader";
import CompanySettingsClient from "./CompanySettingsClient";
import type { CompanySettings } from "../actions";

const DEFAULTS: CompanySettings = {
  company_name: null,
  logo_url: null,
  website: null,
  industry: null,
  company_size: null,
  country: null,
  timezone: "Africa/Nairobi",
  fiscal_year_start: 1,
};

export default async function OverviewPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!can(session.user.role, "manage_system")) redirect("/settings/profile");

  const [
    companyResult,
    { count: staff },
    { count: departments },
    { count: jobs },
    { count: candidates },
  ] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabaseAdmin as any)
      .from("company_settings")
      .select("company_name, logo_url, website, industry, company_size, country, timezone, fiscal_year_start")
      .eq("id", "default")
      .maybeSingle(),
    supabaseAdmin.from("users").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabaseAdmin.from("departments").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("jobs").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("candidates").select("id", { count: "exact", head: true }),
  ]);

  const row = companyResult.data as Partial<CompanySettings> | null;
  const company: CompanySettings = { ...DEFAULTS, ...(row ?? {}) };

  return (
    <div className="space-y-6">
      <SetPageHeader
        title="Company & System"
        description="Your organisation profile and platform settings"
        icon="solar:shop-2-broken"
      />
      <CompanySettingsClient
        initial={company}
        orgStats={{
          staff: staff ?? 0,
          departments: departments ?? 0,
          jobs: jobs ?? 0,
          candidates: candidates ?? 0,
        }}
      />
    </div>
  );
}
