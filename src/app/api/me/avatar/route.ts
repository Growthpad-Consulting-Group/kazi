import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ url: null });

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("avatar_url")
    .eq("id", session.user.id)
    .single();

  let url = (user as { avatar_url: string | null } | null)?.avatar_url ?? null;

  if (!url) {
    const { data: sig } = await (supabaseAdmin as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .from("signature_staff_profiles")
      .select("photo_url")
      .eq("user_id", session.user.id)
      .maybeSingle();
    url = (sig as { photo_url?: string | null } | null)?.photo_url ?? null;
  }

  return NextResponse.json({ url });
}
