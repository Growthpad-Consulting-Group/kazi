import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { syncStaffSignature } from "@/features/signatures/lib/syncStaffSignature";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_signatures")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const result = await syncStaffSignature(id);
  if (result.status === "error") return NextResponse.json({ error: result.message }, { status: 502 });
  if (result.status === "skipped") return NextResponse.json({ error: "No signature is assigned." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
