import { cookies } from "next/headers";

export const PASSKEY_REGISTRATION_COOKIE = "kazi_passkey_registration";
export const PASSKEY_AUTHENTICATION_COOKIE = "kazi_passkey_authentication";

export function passkeyConfig(request: Request) {
  return passkeyConfigFromOrigin(new URL(request.url).origin);
}

export function passkeyConfigFromOrigin(origin: string) {
  return { rpID: new URL(origin).hostname, origin };
}

export async function setPasskeyChallenge(name: string, challenge: string) {
  const store = await cookies();
  store.set(name, challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 5 * 60,
    path: "/",
  });
}

export async function consumePasskeyChallenge(name: string) {
  const store = await cookies();
  const value = store.get(name)?.value;
  store.delete(name);
  return value;
}
