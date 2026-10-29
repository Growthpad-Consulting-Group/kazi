import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { can } from "@/lib/rbac";

type Row = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  job_title: string | null;
  location: string | null;
  start_date: string | null;
  is_active: boolean;
};

function toCsv(rows: Row[]): string {
  const header = [
    "ID",
    "Name",
    "Email",
    "Role",
    "Department",
    "Job Title",
    "Location",
    "Start Date",
    "Active",
  ];
  const lines = rows.map((r) =>
    [
      r.id,
      r.name,
      r.email,
      r.role,
      r.department ?? "",
      r.job_title ?? "",
      r.location ?? "",
      r.start_date ?? "",
      r.is_active ? "Yes" : "No",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\r\n");
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_system")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data } = await supabaseAdmin
    .from("users")
    .select(
      "id, name, email, role, department, job_title, location, start_date, is_active",
    )
    .order("name");

  const rows = (data ?? []) as Row[];
  const csv = toCsv(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="employees-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
