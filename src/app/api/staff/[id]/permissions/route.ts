import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  can,
  GRANTABLE_PERMISSIONS,
  type GrantablePermission,
} from "@/lib/rbac";
import { setExtraPermission } from "@/lib/user-permissions";

type RouteContext = { params: Promise<{ id: string }> };

/** Admins grant or remove a permission for one person, on top of their role. */
export async function POST(request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_roles"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return NextResponse.json(
      { error: "Invalid staff member." },
      { status: 400 },
    );
  if (id === session.user.id)
    return NextResponse.json(
      { error: "You can't change your own extra permissions." },
      { status: 400 },
    );

  const body = (await request.json().catch(() => null)) as {
    permission?: unknown;
    granted?: unknown;
  } | null;
  const permission = GRANTABLE_PERMISSIONS.find(
    (value) => value === body?.permission,
  );
  if (!permission || typeof body?.granted !== "boolean")
    return NextResponse.json(
      { error: "Choose a permission and grant or revoke it." },
      { status: 400 },
    );

  try {
    await setExtraPermission(
      id,
      permission as GrantablePermission,
      body.granted,
      session.user.id,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update permissions.",
      },
      { status: 500 },
    );
  }
}
