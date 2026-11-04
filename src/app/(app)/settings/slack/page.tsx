import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import SetPageHeader from "@/components/ui/SetPageHeader";
import SlackAdminClient from "@/features/settings/components/SlackAdminClient";
import {
  KNOWN_CATEGORIES,
  summariseDeliveries,
  type DeliveryRow,
} from "@/lib/slack-admin";

const DAY = 86_400_000;

export default async function SlackAdminPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!can(session.user.role, "manage_system")) redirect("/settings");

  // Read once per request so the 30-day window is fixed for this render.
  // eslint-disable-next-line react-hooks/purity -- server component; the time is a per-request input
  const since = new Date(Date.now() - 30 * DAY).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed tables
  const db = supabaseAdmin as any;
  const [deliveries, controls, asanaFailing] = await Promise.all([
    db
      .from("slack_notification_deliveries")
      .select("category, status, error")
      .gte("created_at", since)
      .limit(20000),
    db.from("slack_category_controls").select("category, enabled"),
    db
      .from("asana_connections")
      .select("id", { count: "exact", head: true })
      .not("last_sync_error", "is", null),
  ]);

  const summary = summariseDeliveries((deliveries.data ?? []) as DeliveryRow[]);
  const enabled = Object.fromEntries(
    ((controls.data ?? []) as { category: string; enabled: boolean }[]).map(
      (row) => [row.category, row.enabled],
    ),
  );

  return (
    <div className="space-y-6">
      <SetPageHeader
        title="Slack delivery"
        description="Switch categories on or off, send a test, and see why messages were held back. Message contents are never shown here."
        icon="solar:chat-round-dots-broken"
      />
      <p className="text-xs text-[var(--text-lo)]">
        Asana connections whose last sync failed:{" "}
        <span className="font-mono font-semibold text-[var(--text-hi)]">
          {asanaFailing.count ?? 0}
        </span>
        . Task names and details are never shown here.
      </p>
      <SlackAdminClient
        categories={[...KNOWN_CATEGORIES]}
        enabled={enabled}
        summary={summary}
      />
    </div>
  );
}
