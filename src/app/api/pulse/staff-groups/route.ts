import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { can } from "@/lib/rbac";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("staff_groups")
    .select("id, name, member_ids, created_by, created_at")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, member_ids } = await req.json() as { name?: string; member_ids?: string[] };

  if (!name?.trim()) {
    return NextResponse.json({ error: "Group name is required." }, { status: 400 });
  }
  if (!Array.isArray(member_ids) || member_ids.length < 2) {
    return NextResponse.json({ error: "A staff group requires at least 2 members." }, { status: 400 });
  }

  // Validate all member_ids are active users
  const { data: users } = await supabaseAdmin
    .from("users")
    .select("id")
    .in("id", member_ids)
    .eq("is_active", true);

  if ((users?.length ?? 0) !== member_ids.length) {
    return NextResponse.json({ error: "One or more members are not active users." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("staff_groups")
    .insert({ name: name.trim(), member_ids, created_by: session.user.id })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json() as { id?: string };
  if (!id) return NextResponse.json({ error: "Group id is required." }, { status: 400 });

  // Only the creator OR admin/hr can delete
  const { data: group } = await supabaseAdmin
    .from("staff_groups")
    .select("created_by")
    .eq("id", id)
    .maybeSingle();

  if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });

  const isOwner = group.created_by === session.user.id;
  const isHrAdmin = can(session.user.role, "manage_recognition_campaigns");

  if (!isOwner && !isHrAdmin) {
    return NextResponse.json({ error: "You do not have permission to delete this group." }, { status: 403 });
  }

  const { error } = await supabaseAdmin.from("staff_groups").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
