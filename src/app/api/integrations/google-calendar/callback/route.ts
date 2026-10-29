import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { encryptGoogleToken, getGoogleConfig } from "@/lib/google-calendar";
import { supabaseAdmin } from "@/lib/supabase";

const STATE_COOKIE = "kazi_gcal_oauth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

function resultRedirect(
  origin: string,
  returnTo: string | undefined,
  status: "connected" | "error",
) {
  const destination = new URL(returnTo ?? "/settings/integrations", origin);
  destination.searchParams.set(
    returnTo ? "calendar" : "google_calendar",
    status,
  );
  return NextResponse.redirect(destination);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const session = await getServerSession(authOptions);
  const store = await cookies();
  const oauthCookie = store.get(STATE_COOKIE)?.value;
  store.delete(STATE_COOKIE);

  if (!session || !oauthCookie)
    return resultRedirect(url.origin, undefined, "error");

  let savedState: { state: string; returnTo?: string };
  try {
    savedState = JSON.parse(oauthCookie) as {
      state: string;
      returnTo?: string;
    };
  } catch {
    return resultRedirect(url.origin, undefined, "error");
  }

  const code = url.searchParams.get("code");
  if (!code || url.searchParams.get("state") !== savedState.state) {
    return resultRedirect(url.origin, savedState.returnTo, "error");
  }

  try {
    const config = getGoogleConfig();

    // Exchange code for tokens
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = (await tokenRes.json().catch(() => null)) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
    } | null;

    if (!tokenRes.ok || !tokenData?.access_token || !tokenData?.refresh_token) {
      throw new Error(
        tokenData?.error ?? "Google did not return usable tokens.",
      );
    }

    // Fetch user info for logging (email not stored separately)
    const userInfoRes = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      },
    );
    const userInfo = (await userInfoRes.json().catch(() => null)) as {
      email?: string;
    } | null;
    console.log(
      "Google Calendar OAuth completed for",
      userInfo?.email ?? "unknown",
    );

    // Fetch the primary calendar display name
    const calendarRes = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary",
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      },
    );
    const calendarData = (await calendarRes.json().catch(() => null)) as {
      summary?: string;
    } | null;
    const calendarName = calendarData?.summary ?? null;

    const tokenExpiry = new Date(
      Date.now() + (tokenData.expires_in ?? 3600) * 1000,
    ).toISOString();

    const { error } = await supabaseAdmin
      .from("google_calendar_connections")
      .upsert(
        {
          user_id: session.user.id,
          access_token_ciphertext: encryptGoogleToken(tokenData.access_token),
          refresh_token_ciphertext: encryptGoogleToken(tokenData.refresh_token),
          token_expiry: tokenExpiry,
          calendar_id: "primary",
          // Show the connected Google account so people can tell which calendar this is.
          calendar_name: userInfo?.email ?? calendarName,
        },
        { onConflict: "user_id" },
      );

    if (error)
      throw new Error("Could not save the Google Calendar connection.");

    return resultRedirect(url.origin, savedState.returnTo, "connected");
  } catch (err) {
    console.error("Google Calendar OAuth callback failed", err);
    return resultRedirect(url.origin, savedState.returnTo, "error");
  }
}
