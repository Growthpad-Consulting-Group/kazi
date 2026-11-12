import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { userCan } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { validateCategoryInput } from "@/lib/wall-of-fame-category-rules";
import { loadWallOfFameCategories } from "@/lib/wall-of-fame-categories";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed table
const db = supabaseAdmin as any;

// Reading the list is open to signed-in staff (the page needs the labels). Changing it needs
// the same permission as Wall of Fame cycles.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const categories = await loadWallOfFameCategories({ includeRetired: true });
  return NextResponse.json({ categories });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!userCan(session.user, "manage_recognition_campaigns"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const parsed = validateCategoryInput(body ?? {}, { isNew: true });
  if (!parsed.ok)
    return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { error } = await db.from("wall_of_fame_categories").insert({
    key: parsed.key,
    ...parsed.fields,
    sort_order: parsed.fields.sort_order ?? 100,
  });
  if (error) {
    const duplicate = error.code === "23505";
    return NextResponse.json(
      {
        error: duplicate
          ? "A category with that key already exists."
          : error.message,
      },
      { status: duplicate ? 409 : 500 },
    );
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!userCan(session.user, "manage_recognition_campaigns"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const key = typeof body?.key === "string" ? body.key : "";
  const parsed = validateCategoryInput(body ?? {}, { isNew: false });
  if (!key || !parsed.ok)
    return NextResponse.json(
      { error: parsed.ok ? "Choose a category to update." : parsed.error },
      { status: 400 },
    );

  const { data, error } = await db
    .from("wall_of_fame_categories")
    .update({ ...parsed.fields, updated_at: new Date().toISOString() })
    .eq("key", key)
    .select("key");
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length)
    return NextResponse.json({ error: "Category not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
