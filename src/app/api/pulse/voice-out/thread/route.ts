import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const hashCode = (value: string) => createHash("sha256").update(value).digest("hex");
const validMessage = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.trim().length <= 2000;

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code")?.trim();
  if (!code) return NextResponse.json({ error: "Enter your access code." }, { status: 400 });
  const { data: report } = await supabaseAdmin.from("voice_out_reports").select("id, topic, message, attachments, status, created_at").eq("reply_access_hash", hashCode(code)).eq("allows_follow_up", true).maybeSingle();
  if (!report) return NextResponse.json({ error: "That access code was not recognised." }, { status: 404 });
  const { data: messages } = await supabaseAdmin.from("voice_out_messages").select("id, author_role, message, created_at").eq("report_id", report.id).order("created_at");
  return NextResponse.json({ report, messages: messages ?? [] });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { code?: string; message?: unknown } | null;
  if (!body?.code || !validMessage(body.message)) return NextResponse.json({ error: "An access code and message are required." }, { status: 400 });
  const { data: report } = await supabaseAdmin.from("voice_out_reports").select("id").eq("reply_access_hash", hashCode(body.code.trim())).eq("allows_follow_up", true).maybeSingle();
  if (!report) return NextResponse.json({ error: "That access code was not recognised." }, { status: 404 });
  const { error } = await supabaseAdmin.from("voice_out_messages").insert({ report_id: report.id, author_role: "staff", message: body.message.trim() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
