import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// Only the staff member can change whether their manager sees an overdue count.
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    share?: unknown;
  } | null;
  if (typeof body?.share !== "boolean")
    return NextResponse.json(
      { error: "share must be true or false." },
      { status: 400 },
    );

  // share_task_health_with_manager is migration-backed; generated types lag the migration.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from("asana_connections")
    .update({ share_task_health_with_manager: body.share })
    .eq("user_id", session.user.id)
    .select("id");
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length)
    return NextResponse.json(
      { error: "Connect Asana first." },
      { status: 404 },
    );
  return NextResponse.json({ ok: true, share: body.share });
}
