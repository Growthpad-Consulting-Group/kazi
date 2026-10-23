import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGoogleConfig } from "@/lib/google-calendar";

const STATE_COOKIE = "kazi_gcal_oauth";
const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.redirect(new URL("/login", request.url));

  try {
    const config = getGoogleConfig();
    const state = randomUUID();
    const store = await cookies();
    store.set(STATE_COOKIE, JSON.stringify({ state }), {
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
      scope: "https://www.googleapis.com/auth/calendar.events openid email",
      access_type: "offline",
      prompt: "consent",
      state,
    }).toString();

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Calendar connection could not be started.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
