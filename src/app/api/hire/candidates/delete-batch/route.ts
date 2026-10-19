import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { hasRole } from "@/lib/rbac";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "@/lib/r2";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !hasRole(session.user.role, "hr")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { ids } = await req.json() as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "No IDs provided" }, { status: 400 });
  }
  if (ids.length > 200) {
    return NextResponse.json({ error: "Max 200 records per batch" }, { status: 400 });
  }

  // Fetch CV keys before deleting
  const { data: candidates } = await supabaseAdmin
    .from("candidates")
    .select("id, cv_url")
    .in("id", ids);

  // Delete CV files from R2
  const cvUrls = (candidates ?? [])
    .map((c) => (c as { id: string; cv_url: string | null }).cv_url)
    .filter(Boolean) as string[];

  await Promise.allSettled(
    cvUrls.map((url) => {
      const key = url.split("/").pop();
      if (!key) return Promise.resolve();
      return r2.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key }));
    })
  );

  // Delete DB records (cascades to notes, scorecards, ai_logs via FK)
  const { error } = await supabaseAdmin.from("candidates").delete().in("id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deleted: ids.length });
}
