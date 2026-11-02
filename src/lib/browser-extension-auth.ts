import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const DEFAULT_KAZI_TIMER_EXTENSION_IDS = ["dffnikiadlobakbogmmfjkobjieehcbc"];

function allowedExtensionIds() {
  const configured = process.env.KAZI_TIMER_EXTENSION_IDS?.split(",")
    .map((value) => value.trim())
    .filter((value) => /^[a-p]{32}$/.test(value));
  return configured?.length ? configured : DEFAULT_KAZI_TIMER_EXTENSION_IDS;
}

function isAllowedExtensionId(value: string) {
  return allowedExtensionIds().includes(value);
}

export function createExtensionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashExtensionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isAllowedExtensionRedirectUri(value: string | null) {
  if (!value) return false;
  try {
    const redirect = new URL(value);
    const extensionId = redirect.hostname.replace(/\.chromiumapp\.org$/, "");
    return (
      redirect.protocol === "https:" &&
      redirect.pathname === "/kazi" &&
      redirect.search === "" &&
      redirect.hash === "" &&
      redirect.hostname === `${extensionId}.chromiumapp.org` &&
      isAllowedExtensionId(extensionId)
    );
  } catch {
    return false;
  }
}

export function isAllowedExtensionOrigin(value: string | null) {
  if (!value) return false;
  try {
    const origin = new URL(value);
    return (
      origin.protocol === "chrome-extension:" &&
      origin.pathname === "" &&
      origin.search === "" &&
      origin.hash === "" &&
      isAllowedExtensionId(origin.hostname)
    );
  } catch {
    return false;
  }
}

export function extensionExpiry() {
  return new Date(Date.now() + TOKEN_TTL_MS).toISOString();
}

export function extensionCors(request: Request, response: NextResponse) {
  const origin = request.headers.get("origin");
  if (origin && isAllowedExtensionOrigin(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type",
    );
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
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
