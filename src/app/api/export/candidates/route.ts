import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { hasRole } from "@/lib/rbac";

type Row = {
  id: string; full_name: string; email: string; phone: string | null;
  stage: string; ai_score: number | null; applied_at: string;
  jobs: { title: string } | null;
};

function toCsv(rows: Row[]): string {
  const header = ["ID", "Full Name", "Email", "Phone", "Stage", "AI Score", "Job Title", "Applied At"];
  const lines = rows.map((r) => [
    r.id, r.full_name, r.email, r.phone ?? "", r.stage,
    r.ai_score ?? "", r.jobs?.title ?? "", r.applied_at,
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  return [header.join(","), ...lines].join("\r\n");
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !hasRole(session.user.role, "hr")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data } = await supabaseAdmin
    .from("candidates")
    .select("id, full_name, email, phone, stage, ai_score, applied_at, jobs(title)")
    .order("applied_at", { ascending: false });

  const rows = (data ?? []) as unknown as Row[];
  const csv = toCsv(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="candidates-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
