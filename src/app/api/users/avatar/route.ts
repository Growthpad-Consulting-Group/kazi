import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { uploadToR2 } from "@/lib/r2";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateTables } from "@/lib/cache/invalidate";
import { can } from "@/lib/rbac";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Allow HR/admin to upload on behalf of another user via ?userId=
  const { searchParams } = new URL(request.url);
  const targetId = searchParams.get("userId");
  const userId = targetId && can(session.user.role, "manage_people")
    ? targetId
    : session.user.id;

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file supplied." }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Only image files are accepted." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image must be 5 MB or smaller." }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `users/avatars/${userId}/${randomUUID()}.${ext}`;

  try {
    const url = await uploadToR2(path, Buffer.from(await file.arrayBuffer()), file.type);
    const { error } = await supabaseAdmin.from("users").update({ avatar_url: url }).eq("id", userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await invalidateTables("users");
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Upload failed." }, { status: 500 });
  }
}
