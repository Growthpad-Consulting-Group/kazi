import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCachedNotifications } from "@/lib/cache/queries";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notifications = await getCachedNotifications(session.user.id);
  return NextResponse.json({ notifications });
}
