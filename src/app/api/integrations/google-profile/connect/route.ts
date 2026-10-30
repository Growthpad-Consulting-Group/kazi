import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const STATE_COOKIE = "kazi_google_profile_oauth";
const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri =
    process.env.GOOGLE_PROFILE_REDIRECT_URI ??
    new URL(
      "/api/integrations/google-profile/callback",
      request.url,
    ).toString();
  if (!clientId)
    return NextResponse.json(
      { error: "Google profile connection is not configured." },
      { status: 503 },
    );
  const state = randomUUID();
  (await cookies()).set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  const target = new URL(AUTHORIZE_URL);
  target.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  }).toString();
  return NextResponse.redirect(target);
}
