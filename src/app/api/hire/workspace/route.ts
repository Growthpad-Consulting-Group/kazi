import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getHireCompanyAccess,
  resolveHireWorkspace,
} from "@/lib/hire-company-access";

const HIRE_WORKSPACE_COOKIE = "kazi-hire-workspace";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    company?: unknown;
  } | null;
  if (typeof body?.company !== "string" || !body.company.trim()) {
    return NextResponse.json({ error: "Choose a company" }, { status: 400 });
  }

  try {
    const access = await getHireCompanyAccess(
      session.user.id,
      session.user.role,
    );
    const company = resolveHireWorkspace(access, body.company.trim());
    const response = NextResponse.json({ company: company.slug });
    response.cookies.set(HIRE_WORKSPACE_COOKIE, company.slug, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/hire",
      maxAge: 60 * 60 * 24 * 180,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}
