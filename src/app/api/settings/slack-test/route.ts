import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { deliverSlackNotification } from "@/lib/slack";
import { TEST_SEND_LIMIT_PER_HOUR, isOverLimit } from "@/lib/slack-admin";

// Sends a test message to the administrator only, with a per-hour limit.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_system"))
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 },
    );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed table
  const { count } = await (supabaseAdmin as any)
    .from("slack_notification_deliveries")
    .select("id", { count: "exact", head: true })
    .eq("category", "admin_test")
    .gte("created_at", new Date(Date.now() - 3_600_000).toISOString());
  if (isOverLimit(count ?? 0, TEST_SEND_LIMIT_PER_HOUR))
    return NextResponse.json(
      { error: "Test messages are limited to five per hour." },
      { status: 429 },
    );

  const outcome = await deliverSlackNotification({
    eventKey: `admin-test:${session.user.id}:${Date.now()}`,
    recipientUserId: session.user.id,
    category: "admin_test",
    text: "Kazi test message: Slack delivery is working for your account.",
  });
  return NextResponse.json({ ok: true, outcome });
}
