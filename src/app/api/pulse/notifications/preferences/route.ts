import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

interface PreferencesBody {
  show_on_leaderboard?: boolean;
  campaign_updates?: boolean;
  side_quest_updates?: boolean;
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: PreferencesBody = await req.json();

  // Build only the fields that were explicitly supplied
  const patch: Record<string, unknown> = {};
  if (typeof body.show_on_leaderboard === "boolean") {
    patch.show_on_leaderboard = body.show_on_leaderboard;
  }
  if (typeof body.campaign_updates === "boolean") {
    patch.campaign_updates = body.campaign_updates;
  }
  if (typeof body.side_quest_updates === "boolean") {
    patch.side_quest_updates = body.side_quest_updates;
  }

  // The Insert type doesn't expose updated_at; cast to any for the upsert so the
  // DB trigger/default can handle it, and we just need our typed fields.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from("engagement_notification_preferences")
    .upsert(
      { user_id: session.user.id, ...patch },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 200 });
}
