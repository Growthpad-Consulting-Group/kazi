import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabaseAdmin
    .from("slack_connections")
    .select("channel_name")
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    connected: Boolean(data),
    channel_name: data?.channel_name ?? null,
  });
}
