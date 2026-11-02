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
  const { error } = await db.from("browser_extension_tokens").insert({
    user_id: session.user.id,
    token_hash: hashExtensionToken(token),
    client_name: "kazi-timer",
    expires_at: expiresAt,
  });
  if (error)
    return NextResponse.json(
      { error: "Could not connect the extension" },
      { status: 500 },
    );

  const callback = new URL(redirectUri!);
  callback.hash = new URLSearchParams({
    access_token: token,
    expires_at: expiresAt,
    state,
  }).toString();
  return NextResponse.redirect(callback);
}
