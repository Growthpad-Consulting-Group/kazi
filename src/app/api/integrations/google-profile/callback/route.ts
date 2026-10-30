import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

/** Google serves profile photos at a small default size; ask for a sharp one. */
function highResPhoto(url: string) {
  return /=s\d+(-c)?$/.test(url)
    ? url.replace(/=s\d+(-c)?$/, "=s512-c")
    : `${url}=s512-c`;
}

const STATE_COOKIE = "kazi_google_profile_oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const session = await getServerSession(authOptions);
  const store = await cookies();
  const state = store.get(STATE_COOKIE)?.value;
  store.delete(STATE_COOKIE);
  const redirect = (status: string) =>
    NextResponse.redirect(
      new URL(`/settings/profile?google_profile=${status}`, url.origin),
    );
  if (!session || !state || state !== url.searchParams.get("state"))
    return redirect("error");
  const code = url.searchParams.get("code");
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_PROFILE_REDIRECT_URI ??
    new URL(
      "/api/integrations/google-profile/callback",
      request.url,
    ).toString();
  if (!code || !clientId || !clientSecret) return redirect("error");
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const token = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenResponse.ok || !token.access_token)
      throw new Error("No access token");
    const profileResponse = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      { headers: { Authorization: `Bearer ${token.access_token}` } },
    );
    const profile = (await profileResponse.json()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };
    if (
      !profileResponse.ok ||
      !profile.sub ||
      !profile.email ||
      !profile.email_verified ||
      profile.email.toLowerCase() !== session.user.email?.toLowerCase()
    )
      return redirect("email_mismatch");
    await supabaseAdmin
      .from("users")
      .update({
        name: profile.name?.trim() || session.user.name || "",
        avatar_url: profile.picture ? highResPhoto(profile.picture) : null,
      })
      .eq("id", session.user.id);
    await supabaseAdmin.from("google_profile_connections").upsert(
      {
        user_id: session.user.id,
        google_subject: profile.sub,
        google_email: profile.email.toLowerCase(),
        refreshed_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    return redirect("connected");
  } catch {
    return redirect("error");
  }
}
