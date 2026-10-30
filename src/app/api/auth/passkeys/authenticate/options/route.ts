import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";
import {
  PASSKEY_AUTHENTICATION_COOKIE,
  passkeyConfig,
  setPasskeyChallenge,
} from "@/lib/passkeys";

export async function POST(request: Request) {
  const limit = await checkRateLimit({
    scope: "passkey-login-ip",
    identifier: requestIp(request.headers),
    limit: 10,
    windowSeconds: 15 * 60,
  });
  if (!limit.allowed)
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429 },
    );
  const options = await generateAuthenticationOptions({
    rpID: passkeyConfig(request).rpID,
    userVerification: "required",
  });
  await setPasskeyChallenge(PASSKEY_AUTHENTICATION_COOKIE, options.challenge);
  return NextResponse.json(options);
}
