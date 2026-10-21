import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ASANA_AUTHORIZE_URL = "https://app.asana.com/-/oauth_authorize";
const ASANA_TOKEN_URL = "https://app.asana.com/-/oauth_token";

export function getAsanaConfig(origin: string) {
  const clientId = process.env.ASANA_CLIENT_ID;
  const clientSecret = process.env.ASANA_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Asana OAuth has not been configured.");
  return {
    clientId,
    clientSecret,
    redirectUri: process.env.ASANA_REDIRECT_URI ?? `${origin}/api/integrations/asana/callback`,
  };
}

export function asanaAuthorizeUrl(config: ReturnType<typeof getAsanaConfig>, state: string) {
  const url = new URL(ASANA_AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    state,
    scope: "tasks:read projects:read users:read workspaces:read",
  }).toString();
  return url.toString();
}

export async function exchangeAsanaCode(config: ReturnType<typeof getAsanaConfig>, code: string) {
  return asanaTokenRequest(config, { grant_type: "authorization_code", code, redirect_uri: config.redirectUri });
}

export async function refreshAsanaToken(config: ReturnType<typeof getAsanaConfig>, refreshToken: string) {
  return asanaTokenRequest(config, { grant_type: "refresh_token", refresh_token: refreshToken, redirect_uri: config.redirectUri });
}

async function asanaTokenRequest(config: ReturnType<typeof getAsanaConfig>, fields: Record<string, string>) {
  const body = new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...fields });
  const response = await fetch(ASANA_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const data = await response.json().catch(() => null) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string } | null;
  if (!response.ok || !data?.access_token) throw new Error(data?.error ?? "Asana authorization failed.");
  return data as { access_token: string; refresh_token?: string; expires_in?: number };
}

function encryptionKey() {
  const encoded = process.env.ASANA_TOKEN_ENCRYPTION_KEY;
  if (!encoded) throw new Error("ASANA_TOKEN_ENCRYPTION_KEY is not configured.");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("ASANA_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  return key;
}

/** AES-256-GCM, encoded as version:iv:tag:ciphertext. */
export function encryptAsanaToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptAsanaToken(value: string) {
  const [version, iv, tag, ciphertext] = value.split(":");
  if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("Stored Asana token is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
}
