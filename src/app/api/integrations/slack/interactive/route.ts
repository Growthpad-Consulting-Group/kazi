import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { can } from "@/lib/rbac";
import { verifySlackSignature } from "@/lib/slack-signature";

// Handles button clicks from Slack messages. Every change is attributed to the
// clicking person and checked against Kazi permissions first.
export async function POST(request: Request) {
  const raw = await request.text();
  const valid = verifySlackSignature({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    timestamp: request.headers.get("x-slack-request-timestamp"),
    rawBody: raw,
    signature: request.headers.get("x-slack-signature"),
  });
  if (!valid)
    return NextResponse.json(
      { error: "Invalid Slack signature" },
      { status: 401 },
    );

  const payload = JSON.parse(
    new URLSearchParams(raw).get("payload") ?? "null",
  ) as {
    user?: { id?: string };
    actions?: { action_id?: string; value?: string }[];
  } | null;
  const action = payload?.actions?.[0];
  const slackUserId = payload?.user?.id ?? "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed table
  const db = supabaseAdmin as any;

  const { data: link } = await db
    .from("slack_member_links")
    .select("user_id")
    .eq("slack_member_id", slackUserId)
    .maybeSingle();
  if (!link)
    return NextResponse.json({
      response_type: "ephemeral",
      text: "Your Slack account is not linked to Kazi.",
    });

  if (action?.action_id === "mark_checkin_reviewed" && action.value) {
    const [employeeId, weekStart] = action.value.split("|");
    if (!employeeId || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart ?? ""))
      return NextResponse.json({
        response_type: "ephemeral",
        text: "That action is no longer valid.",
      });

    const [{ data: actor }, { data: employee }] = await Promise.all([
      supabaseAdmin
        .from("users")
        .select("id, role")
        .eq("id", link.user_id)
        .maybeSingle(),
      supabaseAdmin
        .from("users")
        .select("manager_id")
        .eq("id", employeeId)
        .maybeSingle(),
    ]);
    const isManager = employee?.manager_id === link.user_id;
    const allowed = actor && (isManager || can(actor.role, "manage_checkins"));
    if (!allowed)
      return NextResponse.json({
        response_type: "ephemeral",
        text: "You cannot review this check-in.",
      });

    const { data: updated, error } = await supabaseAdmin
      .from("checkins")
      .update({ status: "reviewed" })
      .eq("user_id", employeeId)
      .eq("week_start", weekStart)
      .eq("status", "submitted")
      .select("id");
    if (error)
      return NextResponse.json({
        response_type: "ephemeral",
        text: "Could not mark it reviewed. Try in Kazi.",
      });
    return NextResponse.json({
      response_type: "ephemeral",
      text: updated?.length
        ? "Marked as reviewed in Kazi."
        : "This check-in was already reviewed or changed.",
    });
  }

  return NextResponse.json({
    response_type: "ephemeral",
    text: "That action is not available.",
  });
}
