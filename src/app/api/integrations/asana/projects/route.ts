import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAsanaAccessToken } from "@/lib/asana-completed-tasks";

// Lists the active projects in the person's Asana workspace so they can choose which ones Kazi reads.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await getAsanaAccessToken({
    userId: session.user.id,
    origin: new URL(request.url).origin,
  }).catch(() => ({ connected: false as const }));
  if (!access.connected)
    return NextResponse.json(
      { error: "Connect Asana first." },
      { status: 404 },
    );

  const response = await fetch(
    `https://app.asana.com/api/1.0/workspaces/${access.workspaceGid}/projects?opt_fields=name&archived=false&limit=100`,
    { headers: { Authorization: `Bearer ${access.accessToken}` } },
  ).catch(() => null);
  const payload = (await response?.json().catch(() => null)) as {
    data?: { gid: string; name: string }[];
  } | null;
  if (!response?.ok)
    return NextResponse.json(
      { error: "Asana could not list projects. Reconnect and try again." },
      { status: 502 },
    );
  return NextResponse.json({
    projects: (payload?.data ?? []).map((project) => ({
      gid: project.gid,
      name: project.name,
    })),
  });
}
