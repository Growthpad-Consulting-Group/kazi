import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import {
  isGatedPath,
  isGrantableRole,
  setPageGrant,
} from "@/lib/page-access-server";

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "manage_roles"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    role?: unknown;
    path?: unknown;
    granted?: unknown;
  } | null;
  const role = typeof body?.role === "string" ? body.role : "";
  const path = typeof body?.path === "string" ? body.path : "";
  if (typeof body?.granted !== "boolean")
    return NextResponse.json(
      { error: "granted must be true or false" },
      { status: 400 },
    );
  if (!isGrantableRole(role))
    return NextResponse.json({ error: "Choose a valid role" }, { status: 400 });
  if (!isGatedPath(path))
    return NextResponse.json({ error: "Unknown page" }, { status: 400 });

  try {
    await setPageGrant(role, path, body.granted);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[page-access] update failed", error);
    return NextResponse.json(
      { error: "Could not save access" },
      { status: 500 },
    );
  }
}
