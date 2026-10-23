import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import SetPageHeader from "@/components/ui/SetPageHeader";
import IntegrationsClient from "@/features/settings/components/IntegrationsClient";
import AISettingsClient from "@/features/settings/components/AISettingsClient";
import { getAISettings } from "@/features/settings/queries";

export default async function IntegrationsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const isAdmin = can(session.user.role, "manage_system");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: asanaRow } = await (supabaseAdmin as any)
    .from("asana_connections")
    .select("workspace_name, created_at")
    .eq("user_id", session.user.id)
    .maybeSingle() as { data: { workspace_name?: string; created_at?: string } | null };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: slackRow } = await (supabaseAdmin as any)
    .from("slack_connections")
    .select("channel_name")
    .limit(1)
    .maybeSingle() as { data: { channel_name: string } | null };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: gcalRow } = await (supabaseAdmin as any)
    .from("google_calendar_connections")
    .select("calendar_id, calendar_name, created_at")
    .eq("user_id", session.user.id)
    .maybeSingle() as { data: { calendar_id: string; calendar_name: string | null; created_at: string } | null };

  const googleConnected = Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  );

  const aiSettings = isAdmin ? await getAISettings() : null;

  return (
    <div className="space-y-6">
      <SetPageHeader
        title="Integrations"
        description="Connect external tools and services to Kazi."
        icon="solar:widget-2-broken"
      />
      <IntegrationsClient
        asana={{
          connected: Boolean(asanaRow),
          workspace: asanaRow?.workspace_name,
          connectedAt: asanaRow?.created_at,
        }}
        googleWorkspaceConnected={googleConnected}
        slackStatus={{
          connected: Boolean(slackRow),
          channelName: slackRow?.channel_name ?? null,
        }}
        googleCalendarStatus={{
          connected: Boolean(gcalRow),
          calendarId: gcalRow?.calendar_id ?? null,
          calendarName: gcalRow?.calendar_name ?? null,
        }}
      />
      {isAdmin && aiSettings && <AISettingsClient initial={aiSettings} />}
    </div>
  );
}
