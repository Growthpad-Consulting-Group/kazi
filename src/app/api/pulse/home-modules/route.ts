import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { sanitiseHomeModules } from "@/features/pulse/dashboard/home-modules";

// Each person chooses their own optional cards. The action queue is not configurable.
export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    modules?: unknown;
  } | null;
  const modules = sanitiseHomeModules(body?.modules);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed table
  const { error } = await (supabaseAdmin as any)
    .from("pulse_home_modules")
    .upsert(
      {
        user_id: session.user.id,
        modules,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, modules });
}
