import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getAsanaAccessToken } from "@/lib/asana-completed-tasks";
import {
  buildAsanaTaskPayload,
  validateTaskRequest,
} from "@/lib/asana-task-create";

type Source = { actionText: string; sourcePath: string };

// Only the people in a 1-on-1, or the owner of a development plan, can turn an action into a task.
async function loadSource(
  userId: string,
  sourceType: string,
  sourceId: string,
  actionIndex: number,
): Promise<Source | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed tables
  const db = supabaseAdmin as any;
  if (sourceType === "one_on_one_action") {
    const { data } = await db
      .from("one_on_ones")
      .select("id, manager_id, report_id, action_items")
      .eq("id", sourceId)
      .or(`manager_id.eq.${userId},report_id.eq.${userId}`)
      .maybeSingle();
    const item = (data?.action_items ?? [])[actionIndex] as
      { text: string; done: boolean } | undefined;
    if (!data || !item || item.done) return null;
    return {
      actionText: item.text,
      sourcePath: `/pulse/one-on-ones/${data.id}`,
    };
  }
  if (sourceType === "development_action") {
    const { data } = await db
      .from("idps")
      .select("id, actions")
      .eq("id", sourceId)
      .eq("user_id", userId)
      .maybeSingle();
    const item = (data?.actions ?? [])[actionIndex] as
      { text: string; done: boolean } | undefined;
    if (!data || !item || item.done) return null;
    return { actionText: item.text, sourcePath: "/pulse/idps" };
  }
  return null;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    sourceType?: unknown;
    sourceId?: unknown;
    actionIndex?: unknown;
    projectGid?: unknown;
    dueOn?: unknown;
    confirmed?: unknown;
  } | null;
  // The person must see and confirm the task before anything is created in Asana.
  if (body?.confirmed !== true)
    return NextResponse.json(
      { error: "Confirm the task before it is created." },
      { status: 400 },
    );

  const sourceType = body.sourceType;
  if (sourceType !== "one_on_one_action" && sourceType !== "development_action")
    return NextResponse.json({ error: "Unknown source." }, { status: 400 });
  if (
    typeof body.sourceId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(body.sourceId) ||
    typeof body.actionIndex !== "number" ||
    !Number.isInteger(body.actionIndex) ||
    body.actionIndex < 0
  )
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });

  const checked = validateTaskRequest({
    projectGid: body.projectGid,
    dueOn: body.dueOn,
  });
  if (!checked.ok)
    return NextResponse.json({ error: checked.error }, { status: 400 });

  const userId = session.user.id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed tables
  const db = supabaseAdmin as any;
  const { data: existing } = await db
    .from("asana_task_links")
    .select("asana_task_gid")
    .eq("user_id", userId)
    .eq("source_type", sourceType)
    .eq("source_id", body.sourceId)
    .eq("action_index", body.actionIndex)
    .maybeSingle();
  if (existing)
    return NextResponse.json(
      {
        error: "A task was already created for this action.",
        taskGid: existing.asana_task_gid,
      },
      { status: 409 },
    );

  const source = await loadSource(
    userId,
    sourceType,
    body.sourceId,
    body.actionIndex,
  );
  if (!source)
    return NextResponse.json(
      { error: "That action is not available." },
      { status: 404 },
    );

  const access = await getAsanaAccessToken({
    userId,
    origin: new URL(request.url).origin,
  }).catch(() => ({ connected: false as const }));
  if (!access.connected)
    return NextResponse.json(
      { error: "Connect Asana first." },
      { status: 404 },
    );
  const { data: connection } = await db
    .from("asana_connections")
    .select("asana_user_gid")
    .eq("user_id", userId)
    .maybeSingle();
  if (!connection?.asana_user_gid)
    return NextResponse.json(
      { error: "Reconnect Asana and try again." },
      { status: 409 },
    );

  const appUrl = process.env.PRODUCTION_APP_URL ?? new URL(request.url).origin;
  const payload = buildAsanaTaskPayload({
    actionText: source.actionText,
    appUrl,
    sourcePath: source.sourcePath,
    workspaceGid: access.workspaceGid,
    projectGid: checked.projectGid,
    assigneeGid: connection.asana_user_gid,
    dueOn: checked.dueOn,
  });
  const response = await fetch("https://app.asana.com/api/1.0/tasks", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }).catch(() => null);
  const created = (await response?.json().catch(() => null)) as {
    data?: { gid: string };
  } | null;
  if (!response?.ok || !created?.data?.gid)
    return NextResponse.json(
      { error: "Asana did not create the task. Try again." },
      { status: 502 },
    );

  const { error } = await db.from("asana_task_links").insert({
    user_id: userId,
    source_type: sourceType,
    source_id: body.sourceId,
    action_index: body.actionIndex,
    asana_task_gid: created.data.gid,
    workspace_gid: access.workspaceGid,
    project_gid: checked.projectGid,
  });
  if (error)
    console.error(
      "[asana-tasks] task created but link not stored",
      error.message,
    );
  return NextResponse.json({ ok: true, taskGid: created.data.gid });
}
