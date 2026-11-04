import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

const MAX_PROJECTS = 50;
const GID = /^\d{1,20}$/;

// Staff choose which Asana projects Kazi reads and whether task counts appear in the Slack brief.
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    selectedProjects?: unknown;
    includeInSlackBrief?: unknown;
  } | null;
  const patch: Record<string, unknown> = {};
  if (body?.selectedProjects !== undefined) {
    if (
      !Array.isArray(body.selectedProjects) ||
      body.selectedProjects.length > MAX_PROJECTS ||
      !body.selectedProjects.every(
        (gid) => typeof gid === "string" && GID.test(gid),
      )
    )
      return NextResponse.json(
        { error: "Choose valid projects." },
        { status: 400 },
      );
    patch.selected_project_gids = [
      ...new Set(body.selectedProjects as string[]),
    ];
  }
  if (body?.includeInSlackBrief !== undefined) {
    if (typeof body.includeInSlackBrief !== "boolean")
      return NextResponse.json({ error: "Choose on or off." }, { status: 400 });
    patch.include_in_slack_brief = body.includeInSlackBrief;
  }
  if (!Object.keys(patch).length)
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- columns are typed as optional
  const { data, error } = await (supabaseAdmin as any)
    .from("asana_connections")
    .update(patch)
    .eq("user_id", session.user.id)
    .select("id");
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length)
    return NextResponse.json(
      { error: "Connect Asana first." },
      { status: 404 },
    );
  return NextResponse.json({ ok: true });
}
