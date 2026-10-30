import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGoogleConfig } from "@/lib/google-calendar";

const STATE_COOKIE = "kazi_gcal_oauth";
const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";

function getSafeReturnTo(value: string | null, origin: string) {
  if (!value?.startsWith("/")) return undefined;
  try {
    const destination = new URL(value, origin);
    return destination.origin === origin
      ? `${destination.pathname}${destination.search}${destination.hash}`
      : undefined;
  } catch {
    return undefined;
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.redirect(new URL("/login", request.url));

  try {
    const config = getGoogleConfig();
    const state = randomUUID();
    const returnTo = getSafeReturnTo(
      new URL(request.url).searchParams.get("returnTo"),
      new URL(request.url).origin,
    );
    const store = await cookies();
    store.set(STATE_COOKIE, JSON.stringify({ state, returnTo }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 60,
      path: "/",
    });

    const authUrl = new URL(GOOGLE_AUTHORIZE_URL);
    authUrl.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      // Drive read-only lets a connected Growthpad account import Docs that are
      // shared internally. It never grants write or delete access to Drive.
      scope:
        "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive.readonly openid email",
      access_type: "offline",
      prompt: "consent",
      state,
    }).toString();

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Google Calendar connection could not be started.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
