import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateUserNotifications } from "@/lib/cache/invalidate";

export async function PATCH() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabaseAdmin
    .from("notifications")
    .update({ read: true })
    .eq("user_id", session.user.id)
    .eq("read", false);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await invalidateUserNotifications(session.user.id);
  return NextResponse.json({ ok: true });
}
