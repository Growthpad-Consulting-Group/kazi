import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !["admin", "hr"].includes(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed fields/tables
  const db = supabaseAdmin as any;
  const [{ data: idps }, { data: pips }, { data: checkins }, { data: people }] =
    await Promise.all([
      supabaseAdmin
        .from("idps")
        .select(
          "id, user_id, manager_id, title, goals, status, due_date, created_at, updated_at",
        ),
      db
        .from("pips")
        .select(
          "id, user_id, manager_id, concern, expected_outcomes, start_date, review_date, created_at, resolved_at, outcome, resolution_notes, employee_acknowledged_at, activated_at, activation_exception_reason",
        ),
      db
        .from("pip_checkins")
        .select("pip_id, author_id, note, created_at")
        .order("created_at"),
      supabaseAdmin.from("users").select("id, name, email"),
    ]);
  const name = new Map(
    (people ?? []).map((person: { id: string; name: string }) => [
      person.id,
      person.name,
    ]),
  );
  const rows = [
    [
      "Record type",
      "Record ID",
      "Employee",
      "Manager",
      "Status / outcome",
      "Title or concern",
      "Details",
      "Start / created",
      "Due / review",
      "Acknowledged",
      "Activated",
      "History",
    ],
    ...(idps ?? []).map((idp: Record<string, unknown>) => [
      "Development plan",
      idp.id,
      name.get(String(idp.user_id)) ?? "Former staff",
      name.get(String(idp.manager_id)) ?? "",
      idp.status,
      idp.title,
      idp.goals,
      idp.created_at,
      idp.due_date,
      "",
      "",
      idp.updated_at,
    ]),
    ...(pips ?? []).map((pip: Record<string, unknown>) => [
      "Performance support plan",
      pip.id,
      name.get(String(pip.user_id)) ?? "Former staff",
      name.get(String(pip.manager_id)) ?? "",
      pip.outcome ??
        (pip.resolved_at
          ? "Closed"
          : pip.activated_at
            ? "Active"
            : "Awaiting acknowledgement"),
      pip.concern,
      pip.expected_outcomes,
      pip.start_date,
      pip.review_date,
      pip.employee_acknowledged_at,
      pip.activated_at,
      (checkins ?? [])
        .filter((checkin: { pip_id: string }) => checkin.pip_id === pip.id)
        .map(
          (checkin: { author_id: string; created_at: string; note: string }) =>
            `${checkin.created_at}: ${name.get(checkin.author_id) ?? "Team member"} — ${checkin.note}`,
        )
        .join(" | "),
    ]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        "attachment; filename=performance-audit-export.csv",
      "Cache-Control": "no-store",
    },
  });
}
