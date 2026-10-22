import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { uploadToR2 } from "@/lib/r2";
import { supabaseAdmin } from "@/lib/supabase";

type QueryResult = { data: unknown; error: { message: string } | null };
type Database = {
  from: (table: string) => {
    select: (columns: string) => { order: (column: string, options: { ascending: boolean }) => PromiseLike<QueryResult> };
    insert: (values: Record<string, unknown>) => PromiseLike<QueryResult>;
  };
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function safeFilename(filename: string) {
  const clean = filename.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  return clean || "signature-image";
}

async function requireSignatureManager() {
  const session = await getServerSession(authOptions);
  return session && can(session.user.role, "manage_signatures") ? session : null;
}

export async function GET() {
  if (!await requireSignatureManager()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const database = supabaseAdmin as unknown as Database;
  const { data, error } = await database
    .from("signature_media_assets")
    .select("id, path, public_url, filename, created_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assets: data ?? [] });
}

export async function POST(request: Request) {
  if (!await requireSignatureManager()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Only image files can be added to the media library." }, { status: 400 });
  if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "Images must be 5 MB or smaller." }, { status: 400 });

  const filename = safeFilename(file.name);
  const path = `signatures/media/${randomUUID()}-${filename}`;
  try {
    const publicUrl = await uploadToR2(path, Buffer.from(await file.arrayBuffer()), file.type);
    const database = supabaseAdmin as unknown as Database;
    const { error } = await database.from("signature_media_assets").insert({ path, public_url: publicUrl, filename });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ asset: { path, public_url: publicUrl, filename } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not upload image." }, { status: 500 });
  }
}
