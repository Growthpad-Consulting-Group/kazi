import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  createExtensionToken,
  extensionExpiry,
  hashExtensionToken,
  isAllowedExtensionRedirectUri,
} from "@/lib/browser-extension-auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.redirect(
      new URL(
        `/login?callbackUrl=${encodeURIComponent(request.url)}`,
        request.url,
      ),
    );

  const url = new URL(request.url);
  const redirectUri = url.searchParams.get("redirect_uri");
  const state = url.searchParams.get("state");
  if (
    !isAllowedExtensionRedirectUri(redirectUri) ||
    !state ||
    state.length > 256
  )
    return NextResponse.json(
      { error: "Invalid extension connection request" },
      { status: 400 },
    );

  const token = createExtensionToken();
  const expiresAt = extensionExpiry();
  const db = supabaseAdmin as any; // eslint-disable-line @typescript-eslint/no-explicit-any -- migration adds this table.
  const { data: created, error } = await db
    .from("browser_extension_tokens")
    .insert({
      user_id: session.user.id,
      token_hash: hashExtensionToken(token),
      client_name: "kazi-timer",
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (error || !created)
    return NextResponse.json(
      { error: "Could not connect the extension" },
      { status: 500 },
    );

  // One active connection per staff member: a new connection retires the
  // previous one, so old tokens do not pile up.
  const { error: revokeError } = await db
    .from("browser_extension_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", session.user.id)
    .eq("client_name", "kazi-timer")
    .is("revoked_at", null)
    .neq("id", created.id);
  if (revokeError)
    console.error("Could not revoke earlier Kazi Timer tokens", revokeError);

  const callback = new URL(redirectUri!);
  callback.hash = new URLSearchParams({
    access_token: token,
    expires_at: expiresAt,
    state,
  }).toString();
  return NextResponse.redirect(callback);
}
