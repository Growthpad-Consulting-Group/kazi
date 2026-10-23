import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabaseAdmin as any)
    .from("google_calendar_connections")
    .select("calendar_id, calendar_name")
    .eq("user_id", session.user.id)
    .maybeSingle() as { data: { calendar_id: string; calendar_name: string | null } | null };

  return NextResponse.json({
    connected: Boolean(data),
    calendar_id: data?.calendar_id ?? null,
    calendar_name: data?.calendar_name ?? null,
  });
}
