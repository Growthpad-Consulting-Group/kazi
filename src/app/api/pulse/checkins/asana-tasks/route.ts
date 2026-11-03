import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadCompletedAsanaTasks } from "@/lib/asana-completed-tasks";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const weekStart = params.get("weekStart");
  const day = params.get("date");
  const rangeStart = weekStart ?? day;
  if (!rangeStart || !/^\d{4}-\d{2}-\d{2}$/.test(rangeStart))
    return NextResponse.json(
      { error: "A valid weekStart or date is required." },
      { status: 400 },
    );
  const rangeDays = weekStart ? 7 : 1;

  try {
    const result = await loadCompletedAsanaTasks({
      userId: session.user.id,
      rangeStart,
      rangeDays,
      origin: new URL(request.url).origin,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Asana task import failed", error);
    return NextResponse.json(
      {
        error:
          "The Asana connection needs to be refreshed. Please reconnect and try again.",
      },
      { status: 502 },
    );
  }
}
