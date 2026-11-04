import {
  decryptAsanaToken,
  encryptAsanaToken,
  getAsanaConfig,
  refreshAsanaToken,
} from "@/lib/asana";
import { supabaseAdmin } from "@/lib/supabase";

type AsanaTask = {
  gid: string;
  name: string;
  completed_at: string;
  permalink_url?: string;
  projects?: { gid: string; name: string }[];
};

export type CompletedAsanaTask = {
  id: string;
  name: string;
  completedAt: string;
  project: string | null;
  url: string | null;
};

export type CompletedAsanaTasksResult =
  { connected: false } | { connected: true; tasks: CompletedAsanaTask[] };

/**
 * Resolves a usable token for a staff member's own Asana connection. This is
 * deliberately kept server-only: callers receive the workspace id and token
 * only long enough to make an Asana API request.
 */
export async function getAsanaAccessToken({
  userId,
  origin = "",
}: {
  userId: string;
  origin?: string;
}): Promise<
  | { connected: false }
  | {
      connected: true;
      workspaceGid: string;
      accessToken: string;
      selectedProjectGids: string[];
    }
> {
  const { data: connection } = await supabaseAdmin
    .from("asana_connections")
    .select(
      "id, workspace_gid, access_token_ciphertext, refresh_token_ciphertext, token_expires_at, selected_project_gids",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (!connection) return { connected: false };

  let accessToken = decryptAsanaToken(connection.access_token_ciphertext);
  const expiry = connection.token_expires_at
    ? new Date(connection.token_expires_at).getTime()
    : 0;
  if (expiry <= Date.now() + 5 * 60_000) {
    const config = getAsanaConfig(origin);
    const refreshToken = decryptAsanaToken(connection.refresh_token_ciphertext);
    const refreshed = await refreshAsanaToken(config, refreshToken);
    accessToken = refreshed.access_token;
    await supabaseAdmin
      .from("asana_connections")
      .update({
        access_token_ciphertext: encryptAsanaToken(refreshed.access_token),
        refresh_token_ciphertext: encryptAsanaToken(
          refreshed.refresh_token ?? refreshToken,
        ),
        token_expires_at: refreshed.expires_in
          ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
          : null,
      })
      .eq("id", connection.id);
  }

  return {
    connected: true,
    workspaceGid: connection.workspace_gid,
    accessToken,
    selectedProjectGids: connection.selected_project_gids ?? [],
  };
}

/**
 * Loads the user's completed Asana tasks for a date range starting at
 * `rangeStart` (YYYY-MM-DD, UTC) and spanning `rangeDays` days.
 * Refreshes the access token when needed. Throws when Asana is unreachable
 * or the connection has to be re-established; callers decide how to surface it.
 */
export async function loadCompletedAsanaTasks({
  userId,
  rangeStart,
  rangeDays,
  origin = "",
}: {
  userId: string;
  rangeStart: string;
  rangeDays: number;
  origin?: string;
}): Promise<CompletedAsanaTasksResult> {
  const access = await getAsanaAccessToken({ userId, origin });
  if (!access.connected) return access;

  const start = new Date(`${rangeStart}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + rangeDays);
  const query = new URLSearchParams({
    "assignee.any": "me",
    completed: "true",
    "completed_at.after": start.toISOString(),
    "completed_at.before": end.toISOString(),
    sort_by: "completed_at",
    sort_ascending: "false",
    limit: "100",
    opt_fields:
      "gid,name,completed_at,permalink_url,projects.gid,projects.name",
  });
  const response = await fetch(
    `https://app.asana.com/api/1.0/workspaces/${access.workspaceGid}/tasks/search?${query}`,
    { headers: { Authorization: `Bearer ${access.accessToken}` } },
  );
  const payload = (await response.json().catch(() => null)) as {
    data?: AsanaTask[];
    errors?: { message?: string }[];
  } | null;
  if (!response.ok)
    throw new Error(
      payload?.errors?.[0]?.message ?? "Asana could not load completed tasks.",
    );

  return {
    connected: true,
    tasks: (payload?.data ?? []).map((task) => ({
      id: task.gid,
      name: task.name,
      completedAt: task.completed_at,
      project: task.projects?.[0]?.name ?? null,
      url: task.permalink_url ?? null,
    })),
  };
}
