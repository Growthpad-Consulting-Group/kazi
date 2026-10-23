import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { can } from "@/lib/rbac";
import type { AutomationTrigger, AutomationAction } from "@/types/database";

const TRIGGER_TYPES: AutomationTrigger[] = [
  "milestone_anniversary",
  "campaign_start",
  "quest_ends_soon",
  "recognition_received",
];
const ACTION_TYPES: AutomationAction[] = ["send_notification", "award_points"];

export async function GET(): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "manage_automations")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("automation_rules")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "manage_automations")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { trigger_type, action_type, config } = await req.json();

  if (!TRIGGER_TYPES.includes(trigger_type as AutomationTrigger)) {
    return NextResponse.json({ error: "Invalid trigger_type." }, { status: 400 });
  }
  if (!ACTION_TYPES.includes(action_type as AutomationAction)) {
    return NextResponse.json({ error: "Invalid action_type." }, { status: 400 });
  }
  if (action_type === "award_points" && config?.points !== undefined) {
    const points = Number(config.points);
    if (!Number.isInteger(points) || points < 1 || points > 10_000) {
      return NextResponse.json({ error: "Points must be a whole number between 1 and 10,000." }, { status: 400 });
    }
  }

  const { data, error } = await supabaseAdmin
    .from("automation_rules")
    .insert({
      trigger_type: trigger_type as AutomationTrigger,
      action_type: action_type as AutomationAction,
      created_by: session.user.id,
      config: config ?? {},
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data }, { status: 201 });
}
