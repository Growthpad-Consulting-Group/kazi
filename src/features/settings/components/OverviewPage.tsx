import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { isPathAllowed } from "@/lib/page-access";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import SetPageHeader from "@/components/ui/SetPageHeader";
import CompanySettingsClient from "./CompanySettingsClient";
import { EditableArea, ViewOnlyNotice } from "./EditableArea";
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
  culture_leaderboards_enabled: false,
};

export default async function OverviewPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!isPathAllowed(session.user.allowedPaths, "/settings/overview")) redirect("/settings/profile");
  const canEdit = can(session.user.role, "manage_system");

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
      .select("company_name, logo_url, website, industry, company_size, country, timezone, fiscal_year_start, culture_leaderboards_enabled")
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
      {!canEdit && <ViewOnlyNotice permissionLabel="System settings" />}
      <EditableArea canEdit={canEdit}>
        <CompanySettingsClient
          initial={company}
          orgStats={{
            staff: staff ?? 0,
            departments: departments ?? 0,
            jobs: jobs ?? 0,
            candidates: candidates ?? 0,
          }}
        />
      </EditableArea>
    </div>
  );
}
