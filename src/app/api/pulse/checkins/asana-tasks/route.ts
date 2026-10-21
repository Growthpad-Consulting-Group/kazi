import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { decryptAsanaToken, encryptAsanaToken, getAsanaConfig, refreshAsanaToken } from "@/lib/asana";
import { supabaseAdmin } from "@/lib/supabase";

type AsanaTask = { gid: string; name: string; completed_at: string; permalink_url?: string; projects?: { gid: string; name: string }[] };

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const weekStart = new URL(request.url).searchParams.get("weekStart");
  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return NextResponse.json({ error: "A valid weekStart is required." }, { status: 400 });

  const { data: connection } = await supabaseAdmin.from("asana_connections").select("*").eq("user_id", session.user.id).maybeSingle();
  if (!connection) return NextResponse.json({ connected: false });

  try {
    let accessToken = decryptAsanaToken(connection.access_token_ciphertext);
    const expiry = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;
    if (expiry <= Date.now() + 5 * 60_000) {
      const config = getAsanaConfig(new URL(request.url).origin);
      const refreshToken = decryptAsanaToken(connection.refresh_token_ciphertext);
      const refreshed = await refreshAsanaToken(config, refreshToken);
      accessToken = refreshed.access_token;
      await supabaseAdmin.from("asana_connections").update({
        access_token_ciphertext: encryptAsanaToken(refreshed.access_token),
        refresh_token_ciphertext: encryptAsanaToken(refreshed.refresh_token ?? refreshToken),
        token_expires_at: refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString() : null,
      }).eq("id", connection.id);
    }

    const start = new Date(`${weekStart}T00:00:00.000Z`);
    const end = new Date(start); end.setUTCDate(end.getUTCDate() + 7);
    const query = new URLSearchParams({
      "assignee.any": "me",
      completed: "true",
      "completed_at.after": start.toISOString(),
      "completed_at.before": end.toISOString(),
      sort_by: "completed_at",
      sort_ascending: "false",
      limit: "100",
      opt_fields: "gid,name,completed_at,permalink_url,projects.gid,projects.name",
    });
    const response = await fetch(`https://app.asana.com/api/1.0/workspaces/${connection.workspace_gid}/tasks/search?${query}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const payload = await response.json().catch(() => null) as { data?: AsanaTask[]; errors?: { message?: string }[] } | null;
    if (!response.ok) return NextResponse.json({ error: payload?.errors?.[0]?.message ?? "Asana could not load completed tasks." }, { status: 502 });
    return NextResponse.json({ connected: true, tasks: (payload?.data ?? []).map((task) => ({ id: task.gid, name: task.name, completedAt: task.completed_at, project: task.projects?.[0]?.name ?? null, url: task.permalink_url ?? null })) });
  } catch (error) {
    console.error("Asana task import failed", error);
    return NextResponse.json({ error: "The Asana connection needs to be refreshed. Please reconnect and try again." }, { status: 502 });
  }
}
