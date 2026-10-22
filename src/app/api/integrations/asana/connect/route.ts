import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { asanaAuthorizeUrl, getAsanaConfig } from "@/lib/asana";

const STATE_COOKIE = "kazi_asana_oauth";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.redirect(new URL("/login", request.url));

  try {
    const url = new URL(request.url);
    const ALLOWED_RETURN = ["/pulse/checkins", "/settings/integrations"];
    const requestedReturn = url.searchParams.get("returnTo") ?? "";
    const returnTo = ALLOWED_RETURN.some((prefix) => requestedReturn.startsWith(prefix))
      ? requestedReturn
      : "/settings/integrations";
    const state = randomUUID();
    const config = getAsanaConfig(url.origin);
    const store = await cookies();
    store.set(STATE_COOKIE, JSON.stringify({ state, returnTo }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 60,
      path: "/",
    });
    return NextResponse.redirect(asanaAuthorizeUrl(config, state));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Asana connection could not be started.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
