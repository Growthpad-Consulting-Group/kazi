import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

const MAX_CLIENT_NAME = 100;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await (supabaseAdmin as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .from("daily_log_clients")
    .select("name")
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ clients: ((data ?? []) as { name: string }[]).map((row) => row.name) });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length > MAX_CLIENT_NAME) {
    return NextResponse.json({ error: `Client names need 1 to ${MAX_CLIENT_NAME} characters` }, { status: 400 });
  }

  const db = supabaseAdmin as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data: existing } = await db
    .from("daily_log_clients")
    .select("name")
    .ilike("name", name)
    .maybeSingle();
  if (existing) return NextResponse.json({ name: (existing as { name: string }).name });

  const { data, error } = await db
    .from("daily_log_clients")
    .insert({ name, created_by: session.user.id })
    .select("name")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ name: (data as { name: string }).name }, { status: 201 });
}
