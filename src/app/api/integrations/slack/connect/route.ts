import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "manage_system")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    webhook_url?: string;
    channel_name?: string;
  };
  const { webhook_url, channel_name } = body;

  if (!webhook_url || !channel_name) {
    return NextResponse.json(
      { error: "webhook_url and channel_name are required" },
      { status: 400 },
    );
  }

  if (!webhook_url.startsWith("https://hooks.slack.com/")) {
    return NextResponse.json(
      { error: "webhook_url must start with https://hooks.slack.com/" },
      { status: 400 },
    );
  }

  // Remove any existing Slack connection (singleton row per org)
  await supabaseAdmin
    .from("slack_connections")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  const { error } = await supabaseAdmin.from("slack_connections").insert({
    webhook_url,
    channel_name,
    created_by: session.user.id,
  });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
