import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { createStaffMember } from "@/lib/staff-create";
import type { UserRole } from "@/types/database";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_people")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const str = (value: unknown) => (typeof value === "string" ? value : null);
  const result = await createStaffMember(
    {
      name: str(body.name) ?? "",
      email: str(body.email) ?? "",
      password: str(body.password) ?? "",
      role: str(body.role) ?? "employee",
      department: str(body.department),
      jobTitle: str(body.jobTitle),
      location: str(body.location),
      managerId: str(body.managerId),
      startDate: str(body.startDate),
    },
    session.user.role as UserRole,
  );
  if (!result.ok)
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  return NextResponse.json({
    person: result.person,
    signatureProfileCreated: result.signatureProfileCreated,
  });
}
