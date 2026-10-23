import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabaseAdmin
    .from("google_calendar_connections")
    .select("calendar_id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  return NextResponse.json({
    connected: Boolean(data),
    calendar_id: data?.calendar_id ?? null,
  });
}
