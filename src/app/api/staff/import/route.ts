import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { createStaffMember } from "@/lib/staff-create";
import type { UserRole } from "@/types/database";

const MAX_ROWS = 200;

type ImportRow = {
  name?: unknown;
  email?: unknown;
  password?: unknown;
  role?: unknown;
  department?: unknown;
  job_title?: unknown;
  location?: unknown;
  manager_email?: unknown;
  start_date?: unknown;
};

const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

/**
 * Creates staff from a CSV the recruiter has already checked. Every row goes
 * through the same rules as the single-person form. A failed row never stops
 * the rest, and each row's outcome is returned.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_people"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    rows?: unknown;
  } | null;
  const rows = Array.isArray(body?.rows) ? (body.rows as ImportRow[]) : null;
  if (!rows || rows.length === 0)
    return NextResponse.json({ error: "No rows to import." }, { status: 400 });
  if (rows.length > MAX_ROWS)
    return NextResponse.json(
      { error: `Import at most ${MAX_ROWS} people at a time.` },
      { status: 400 },
    );

  // Resolve manager emails to ids in one query.
  const managerEmails = [
    ...new Set(
      rows.map((row) => text(row.manager_email).toLowerCase()).filter(Boolean),
    ),
  ];
  const managerIds = new Map<string, string>();
  if (managerEmails.length) {
    const { data } = await supabaseAdmin
      .from("users")
      .select("id, email")
      .in("email", managerEmails);
    for (const manager of data ?? []) managerIds.set(manager.email, manager.id);
  }

  const results: {
    line: number;
    email: string;
    ok: boolean;
    error?: string;
  }[] = [];
  for (const [index, row] of rows.entries()) {
    const line = index + 2; // header row is line 1
    const email = text(row.email).toLowerCase();
    const managerEmail = text(row.manager_email).toLowerCase();
    if (managerEmail && !managerIds.has(managerEmail)) {
      results.push({
        line,
        email,
        ok: false,
        error: "Manager email not found.",
      });
      continue;
    }
    const result = await createStaffMember(
      {
        name: text(row.name),
        email,
        password: text(row.password),
        role: text(row.role) || "employee",
        department: text(row.department) || null,
        jobTitle: text(row.job_title) || null,
        location: text(row.location) || null,
        managerId: managerEmail ? (managerIds.get(managerEmail) ?? null) : null,
        startDate: text(row.start_date) || null,
      },
      session.user.role as UserRole,
    );
    results.push(
      result.ok
        ? { line, email, ok: true }
        : { line, email, ok: false, error: result.error },
    );
  }

  return NextResponse.json({
    created: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok),
  });
}
