import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("jobs")
    .select(
      "id, slug, title, department, location, description, requirements, published_at, closes_at",
    )
    .eq("slug", slug)
    .eq("status", "open")
    .or(`published_at.is.null,published_at.lte.${now}`)
    .or(`closes_at.is.null,closes_at.gt.${now}`)
    .maybeSingle();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json({ job: data });
}
