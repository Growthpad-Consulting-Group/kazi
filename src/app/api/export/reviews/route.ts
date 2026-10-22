import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { can } from "@/lib/rbac";

type Row = {
  id: string; type: string; status: string; overall_rating: number | null;
  strengths: string | null; development_areas: string | null; submitted_at: string | null;
  review_cycles: { title: string; cycle: string } | null;
};

function toCsv(rows: Row[]): string {
  const header = ["Review ID", "Cycle", "Frequency", "Type", "Status", "Overall Rating", "Strengths", "Development Areas", "Submitted At"];
  const lines = rows.map((r) => [
    r.id, r.review_cycles?.title ?? "", r.review_cycles?.cycle ?? "",
    r.type, r.status, r.overall_rating ?? "",
    r.strengths ?? "", r.development_areas ?? "", r.submitted_at ?? "",
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  return [header.join(","), ...lines].join("\r\n");
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_system")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data } = await supabaseAdmin
    .from("performance_reviews")
    .select("id, type, status, overall_rating, strengths, development_areas, submitted_at, review_cycles(title, cycle)")
    .order("submitted_at", { ascending: false });

  const rows = (data ?? []) as unknown as Row[];
  const csv = toCsv(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reviews-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
