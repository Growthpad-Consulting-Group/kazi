import { NextResponse } from "next/server";
import {
  extensionCors,
  extensionTokenUser,
} from "@/lib/browser-extension-auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function OPTIONS(request: Request) {
  return extensionCors(request, new NextResponse(null, { status: 204 }));
}

export async function GET(request: Request) {
  const token = await extensionTokenUser(request);
  if (!token)
    return extensionCors(
      request,
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  const db = supabaseAdmin as any; // eslint-disable-line @typescript-eslint/no-explicit-any -- client table is not in generated types.
  const { data, error } = await db
    .from("daily_log_clients")
    .select("name")
    .order("name");
  if (error)
    return extensionCors(
      request,
      NextResponse.json({ error: "Could not load clients" }, { status: 500 }),
    );
  return extensionCors(
    request,
    NextResponse.json({
      clients: (data ?? []).map((row: { name: string }) => row.name),
    }),
  );
}
