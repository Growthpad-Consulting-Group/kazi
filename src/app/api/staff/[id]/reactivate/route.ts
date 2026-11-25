import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateTables } from "@/lib/cache/invalidate";
import { linkSignatureProfile } from "@/lib/staff-create";

/** Brings a removed staff member back: sets the account active and re-links their signature profile. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_people"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { data: person, error: readError } = await supabaseAdmin
    .from("users")
    .select("id, name, email, role, is_active, job_title, department")
    .eq("id", id)
    .maybeSingle();
  if (readError)
    return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!person)
    return NextResponse.json(
      { error: "Staff member not found." },
      { status: 404 },
    );
  if (person.is_active)
    return NextResponse.json({ ok: true, alreadyActive: true });
  if (person.role === "admin" && session.user.role !== "admin")
    return NextResponse.json(
      { error: "Only an administrator can reactivate an admin account." },
      { status: 403 },
    );

  const { error } = await supabaseAdmin
    .from("users")
    .update({ is_active: true })
    .eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const signature = await linkSignatureProfile({
    id: person.id,
    email: person.email,
    name: person.name,
    jobTitle: person.job_title,
    department: person.department,
  });
  await invalidateTables("users");
  if (signature.error)
    return NextResponse.json(
      {
        error: `Account reactivated, but its signature profile could not be linked: ${signature.error}`,
      },
      { status: 500 },
    );
  return NextResponse.json({
    ok: true,
    signatureProfileLinked: signature.linked,
  });
}
