import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  encryptAsanaToken,
  exchangeAsanaCode,
  getAsanaConfig,
} from "@/lib/asana";
import { supabaseAdmin } from "@/lib/supabase";

const STATE_COOKIE = "kazi_asana_oauth";

type AsanaMe = {
  gid: string;
  email?: string;
  workspaces?: { gid: string; name?: string }[];
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fallback = new URL("/settings/integrations?asana=error", url.origin);
  const session = await getServerSession(authOptions);
  const store = await cookies();
  const oauthCookie = store.get(STATE_COOKIE)?.value;
  store.delete(STATE_COOKIE);
  if (!session || !oauthCookie) return NextResponse.redirect(fallback);

  let savedState: { state: string; returnTo: string };
  try {
    savedState = JSON.parse(oauthCookie) as { state: string; returnTo: string };
  } catch {
    return NextResponse.redirect(fallback);
  }
  const code = url.searchParams.get("code");
  if (!code || url.searchParams.get("state") !== savedState.state)
    return NextResponse.redirect(fallback);

  try {
    const config = getAsanaConfig(url.origin);
    const tokens = await exchangeAsanaCode(config, code);
    const meResponse = await fetch(
      "https://app.asana.com/api/1.0/users/me?opt_fields=gid,email,workspaces.gid,workspaces.name",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      },
    );
    const meJson = (await meResponse.json().catch(() => null)) as {
      data?: AsanaMe;
    } | null;
    const asanaUser = meJson?.data;
    const workspace = asanaUser?.workspaces?.[0];
    if (!meResponse.ok || !asanaUser || !workspace || !tokens.refresh_token)
      throw new Error("Asana did not return a usable account connection.");

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;
    const { error } = await supabaseAdmin.from("asana_connections").upsert(
      {
        user_id: session.user.id,
        asana_user_gid: asanaUser.gid,
        asana_email: asanaUser.email ?? null,
        workspace_gid: workspace.gid,
        workspace_name: workspace.name ?? null,
        access_token_ciphertext: encryptAsanaToken(tokens.access_token),
        refresh_token_ciphertext: encryptAsanaToken(tokens.refresh_token),
        token_expires_at: expiresAt,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error("Could not save the Asana connection.");

    const returnUrl = new URL(savedState.returnTo, url.origin);
    returnUrl.searchParams.set("asana", "connected");
    return NextResponse.redirect(returnUrl);
  } catch (error) {
    console.error("Asana OAuth callback failed", error);
    return NextResponse.redirect(fallback);
  }
}
