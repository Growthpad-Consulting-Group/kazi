import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { getAsanaAccessToken } from "@/lib/asana-completed-tasks";

const GID = /^\d{1,20}$/;

// Administrators subscribe Kazi to chosen projects only, never the whole workspace.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_system"))
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 },
    );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed tables
  const { data } = await (supabaseAdmin as any)
    .from("asana_webhook_subscriptions")
    .select(
      "id, project_gid, status, last_event_at, last_reconciled_at, created_at",
    )
    .order("created_at", { ascending: false });
  return NextResponse.json({ subscriptions: data ?? [] });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_system"))
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 },
    );

  const body = (await request.json().catch(() => null)) as {
    projectGid?: unknown;
  } | null;
  if (typeof body?.projectGid !== "string" || !GID.test(body.projectGid))
    return NextResponse.json({ error: "Choose one project." }, { status: 400 });

  const origin = new URL(request.url).origin;
  const access = await getAsanaAccessToken({
    userId: session.user.id,
    origin,
  }).catch(() => ({ connected: false as const }));
  if (!access.connected)
    return NextResponse.json(
      { error: "Connect your Asana account first." },
      { status: 409 },
    );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed tables
  const db = supabaseAdmin as any;
  const registrationToken = randomBytes(32).toString("base64url");
  const { data: sub, error } = await db
    .from("asana_webhook_subscriptions")
    .insert({
      registration_token: registrationToken,
      workspace_gid: access.workspaceGid,
      project_gid: body.projectGid,
      created_by: session.user.id,
    })
    .select("id")
    .single();
  if (error)
    return NextResponse.json(
      { error: "This project is already subscribed." },
      { status: 409 },
    );

  const appUrl = process.env.PRODUCTION_APP_URL ?? origin;
  const response = await fetch("https://app.asana.com/api/1.0/webhooks", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        resource: body.projectGid,
        target: `${appUrl}/api/integrations/asana/webhooks?reg=${registrationToken}`,
      },
    }),
  }).catch(() => null);
  const created = (await response?.json().catch(() => null)) as {
    data?: { gid: string };
  } | null;
  if (!response?.ok || !created?.data?.gid) {
    await db
      .from("asana_webhook_subscriptions")
      .update({ status: "failed" })
      .eq("id", sub.id);
    return NextResponse.json(
      { error: "Asana did not create the webhook." },
      { status: 502 },
    );
  }
  await db
    .from("asana_webhook_subscriptions")
    .update({ webhook_gid: created.data.gid })
    .eq("id", sub.id);
  return NextResponse.json({ ok: true, id: sub.id });
}
