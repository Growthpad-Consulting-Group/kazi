import { NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import type { VoiceOutPriority, VoiceOutStatus } from "@/types/database";

const TOPICS = ["workplace", "wellbeing", "inclusion", "leadership", "other"] as const;
const MAX_ATTACHMENTS = 3;

function validAttachments(value: unknown): value is string[] {
  const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  return Array.isArray(value) && value.length <= MAX_ATTACHMENTS && value.every((url) => typeof url === "string" && !!publicUrl && url.startsWith(`${publicUrl}/pulse/voice-out/`));
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as { topic?: string; message?: string; attachments?: unknown; allows_follow_up?: boolean; sentiment?: string } | null;
  const topic = body?.topic;
  const message = body?.message?.trim();
  if (!topic || !TOPICS.includes(topic as typeof TOPICS[number]) || !message || message.length < 20 || message.length > 2000) {
    return NextResponse.json({ error: "Choose a topic and enter a message between 20 and 2,000 characters." }, { status: 400 });
  }
  if (body?.attachments !== undefined && !validAttachments(body.attachments)) return NextResponse.json({ error: "Attachments must be up to three uploaded Voice Out images." }, { status: 400 });
  if (body?.sentiment && !["negative", "neutral", "positive"].includes(body.sentiment)) return NextResponse.json({ error: "Choose a valid sentiment signal." }, { status: 400 });

  const allowsFollowUp = body?.allows_follow_up === true;
  const accessCode = allowsFollowUp ? randomBytes(24).toString("base64url") : null;
  const replyAccessHash = accessCode ? createHash("sha256").update(accessCode).digest("hex") : null;

  // Deliberately do not persist the session user ID. Voice Out must not be traceable
  // back to an employee through this application table or its operational UI.
  const { error } = await supabaseAdmin.from("voice_out_reports").insert({ topic: topic as typeof TOPICS[number], message, attachments: body?.attachments ?? [], allows_follow_up: allowsFollowUp, reply_access_hash: replyAccessHash, sentiment: (body?.sentiment ?? "neutral") as "negative" | "neutral" | "positive" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, accessCode });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_voice_out")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null) as { id?: string; status?: string; priority?: string; internal_notes?: string; take_ownership?: boolean; reply?: string } | null;
  if (!body?.id) return NextResponse.json({ error: "Report id is required." }, { status: 400 });

  const update: { status?: VoiceOutStatus; priority?: VoiceOutPriority; internal_notes?: string | null; owner_id?: string; resolved_at?: string | null } = {};
  if (body.status && ["new", "in_review", "resolved", "archived"].includes(body.status)) {
    update.status = body.status as VoiceOutStatus;
    update.resolved_at = body.status === "resolved" ? new Date().toISOString() : null;
  }
  if (body.priority && ["low", "normal", "high", "urgent"].includes(body.priority)) update.priority = body.priority as VoiceOutPriority;
  if (typeof body.internal_notes === "string") update.internal_notes = body.internal_notes.trim() || null;
  if (body.take_ownership) update.owner_id = session.user.id;
  if (body.reply?.trim()) {
    if (body.reply.trim().length > 2000) return NextResponse.json({ error: "A reply must be 2,000 characters or fewer." }, { status: 400 });
    const { data: report } = await supabaseAdmin.from("voice_out_reports").select("allows_follow_up").eq("id", body.id).maybeSingle();
    if (!report?.allows_follow_up) return NextResponse.json({ error: "This report did not opt in to anonymous follow-up." }, { status: 400 });
    const { error } = await supabaseAdmin.from("voice_out_messages").insert({ report_id: body.id, author_role: "hr", message: body.reply.trim() });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!Object.keys(update).length && !body.reply?.trim()) return NextResponse.json({ error: "No valid changes supplied." }, { status: 400 });

  if (Object.keys(update).length) {
    const { error } = await supabaseAdmin.from("voice_out_reports").update(update).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
