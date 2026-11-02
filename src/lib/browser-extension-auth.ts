import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const CHROME_REDIRECT_URI = /^https:\/\/[a-p]{32}\.chromiumapp\.org\/kazi$/;

export function createExtensionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashExtensionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isAllowedExtensionRedirectUri(value: string | null) {
  return Boolean(value && CHROME_REDIRECT_URI.test(value));
}

export function extensionExpiry() {
  return new Date(Date.now() + TOKEN_TTL_MS).toISOString();
}

export function extensionCors(request: Request, response: NextResponse) {
  const origin = request.headers.get("origin");
  if (origin?.startsWith("chrome-extension://")) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type",
    );
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, DELETE, OPTIONS",
    );
  }
  return response;
}

export async function extensionTokenUser(request: Request) {
  const bearer = request.headers
    .get("authorization")
    ?.match(/^Bearer (.+)$/i)?.[1];
  if (!bearer) return null;
  const db = supabaseAdmin as any; // eslint-disable-line @typescript-eslint/no-explicit-any -- extension tables await generated types.
  const { data } = await db
    .from("browser_extension_tokens")
    .select("id, user_id")
    .eq("token_hash", hashExtensionToken(bearer))
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!data) return null;
  await db
    .from("browser_extension_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);
  return data as { id: string; user_id: string };
}
