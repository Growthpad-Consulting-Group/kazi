import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("jobs")
    .select(
      "id, slug, title, department, location, description, requirements, employment_type, work_mode, contract_duration, compensation, reports_to, benefits, application_instructions, selection_process, published_at, closes_at",
    )
    .eq("status", "open")
    .or(`published_at.is.null,published_at.lte.${now}`)
    .or(`closes_at.is.null,closes_at.gt.${now}`)
    .order("published_at", { ascending: false, nullsFirst: false });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data });
}
