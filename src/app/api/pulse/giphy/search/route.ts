import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GIPHY_API_KEY;
  if (!apiKey)
    return NextResponse.json(
      {
        error:
          "GIF search is not set up yet. Ask an admin to add a GIPHY_API_KEY.",
      },
      { status: 503 },
    );

  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ data: [] });

  const response = await fetch(
    `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(q)}&limit=8&rating=g`,
  );
  const payload = (await response.json().catch(() => null)) as {
    data?: unknown[];
    meta?: { msg?: string };
  } | null;
  if (!response.ok || !payload?.data) {
    return NextResponse.json(
      {
        error: `GIF search failed${payload?.meta?.msg ? `: ${payload.meta.msg}` : "."}`,
      },
      { status: 502 },
    );
  }
  return NextResponse.json({ data: payload.data });
}
