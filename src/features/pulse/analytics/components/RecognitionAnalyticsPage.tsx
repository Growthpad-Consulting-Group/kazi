import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { RecognitionAnalyticsFilters } from "./RecognitionAnalyticsFilters";
import RecognitionAnalyticsSection from "./RecognitionAnalyticsSection";
import ExportReportButton from "./ExportReportButton";

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

function computeSince(range: string): Date | undefined {
  if (range === "all") return undefined;
  const days = range === "90d" ? 90 : 30;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function getString(
  v: string | string[] | undefined,
  fallback?: string,
): string | undefined {
  if (Array.isArray(v)) return v[0] ?? fallback;
  return v ?? fallback;
}

export default async function RecognitionAnalyticsPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  if (!can(session.user.role, "view_analytics")) redirect("/pulse");

  const range = getString(searchParams.range, "30d") ?? "30d";
  const departmentFilter = getString(searchParams.dept);
  const campaignId = getString(searchParams.campaign);

  const since = computeSince(range);

  // Fetch filter options server-side for the filters component
  const [{ data: deptRows }, { data: campaignRows }] = await Promise.all([
    supabaseAdmin
      .from("users")
      .select("department")
      .eq("is_active", true)
      .not("department", "is", null),
    supabaseAdmin
      .from("recognition_campaigns")
      .select("id, name")
      .order("name"),
  ]);

  const departments = [
    ...new Set(
      (deptRows ?? [])
        .map((r: { department: string | null }) => r.department)
        .filter((d): d is string => typeof d === "string" && d.length > 0),
    ),
  ].sort();

  const campaigns = (campaignRows ?? []) as { id: string; name: string }[];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <SetPageHeader
        title="Recognition Analytics"
        description="Insights into recognition activity, trends and value usage"
        icon="solar:heart-broken"
        trailing={<ExportReportButton />}
      />

      <Suspense>
        <RecognitionAnalyticsFilters
          departments={departments}
          campaigns={campaigns}
        />
      </Suspense>

      <RecognitionAnalyticsSection
        since={since}
        departmentFilter={departmentFilter}
        campaignId={campaignId}
      />
    </div>
  );
}
