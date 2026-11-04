import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { KNOWN_CATEGORIES } from "@/lib/slack-admin";

// Administrators only. Switches a whole Slack category on or off for everyone.
export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_system"))
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 },
    );

  const body = (await request.json().catch(() => null)) as {
    category?: unknown;
    enabled?: unknown;
  } | null;
  if (
    typeof body?.category !== "string" ||
    !(KNOWN_CATEGORIES as readonly string[]).includes(body.category) ||
    typeof body.enabled !== "boolean"
  )
    return NextResponse.json(
      { error: "Choose a known category and on/off." },
      { status: 400 },
    );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed table
  const { error } = await (supabaseAdmin as any)
    .from("slack_category_controls")
    .upsert(
      {
        category: body.category,
        enabled: body.enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "category" },
    );
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
