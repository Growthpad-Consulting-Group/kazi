import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { syncStaffSignature } from "@/features/signatures/lib/syncStaffSignature";

type Result = { data?: unknown; error: { message: string } | null };
type Database = {
  from: (table: string) => {
    select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => PromiseLike<Result> } };
    update: (values: Record<string, unknown>) => { eq: (column: string, value: string) => PromiseLike<Result> };
  };
};

const MAX_ROLE_TITLE_LENGTH = 120;

/** Lets a signed-in person change their own role title. Other fields stay managed by HR and admins. */
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { role_title?: unknown } | null;
  const roleTitle = typeof body?.role_title === "string" ? body.role_title.trim() : null;
  if (roleTitle === null) return NextResponse.json({ error: "Enter a role title." }, { status: 400 });
  if (roleTitle.length > MAX_ROLE_TITLE_LENGTH) {
    return NextResponse.json({ error: `Keep the role title under ${MAX_ROLE_TITLE_LENGTH} characters.` }, { status: 400 });
  }

  const database = supabaseAdmin as unknown as Database;
  const { data: profile, error: profileError } = await database
    .from("signature_staff_profiles")
    .select("id")
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: "No signature profile is linked to your account." }, { status: 404 });
  const { id } = profile as { id: string };

  const { error } = await database.from("signature_staff_profiles").update({ role_title: roleTitle || null }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const gmail = await syncStaffSignature(id);
  return NextResponse.json({ ok: true, gmail: gmail.status, gmailError: gmail.status === "error" ? gmail.message : undefined });
}
