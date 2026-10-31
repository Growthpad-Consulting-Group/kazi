import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import {
  verifyRegistrationResponse,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  PASSKEY_REGISTRATION_COOKIE,
  consumePasskeyChallenge,
  passkeyConfig,
} from "@/lib/passkeys";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const challenge = await consumePasskeyChallenge(PASSKEY_REGISTRATION_COOKIE);
  if (!session || !challenge)
    return NextResponse.json(
      { error: "Registration expired. Try again." },
      { status: 400 },
    );
  try {
    const body = (await request.json()) as RegistrationResponseJSON & {
      deviceLabel?: unknown;
    };
    const { deviceLabel, ...response } = body;
    const config = passkeyConfig(request);
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo)
      throw new Error("Passkey could not be verified.");
    const credential = verification.registrationInfo.credential;
    const db = supabaseAdmin as unknown as {
      from: (table: string) => {
        upsert: (
          value: unknown,
          options: unknown,
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
    const { error } = await db.from("passkeys").upsert(
      {
        user_id: session.user.id,
        credential_id: credential.id,
        public_key: Buffer.from(credential.publicKey).toString("base64url"),
        counter: credential.counter,
        transports: response.response.transports ?? [],
        device_type: verification.registrationInfo.credentialDeviceType,
        backed_up: verification.registrationInfo.credentialBackedUp,
        device_label:
          typeof deviceLabel === "string" ? deviceLabel.slice(0, 80) : null,
      },
      { onConflict: "credential_id" },
    );
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Passkey could not be saved.",
      },
      { status: 400 },
    );
  }
}
