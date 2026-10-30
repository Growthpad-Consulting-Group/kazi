import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  PASSKEY_REGISTRATION_COOKIE,
  passkeyConfig,
  setPasskeyChallenge,
} from "@/lib/passkeys";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string,
        ) => { data: { credential_id: string; transports: string[] }[] | null };
      };
    };
  };
  const { data: existing } = await db
    .from("passkeys")
    .select("credential_id, transports")
    .eq("user_id", session.user.id);
  const config = passkeyConfig(request);
  const options = await generateRegistrationOptions({
    rpName: "Kazi by Growthpad",
    rpID: config.rpID,
    userName: session.user.email,
    userDisplayName: session.user.name,
    userID: new TextEncoder().encode(session.user.id),
    attestationType: "none",
    excludeCredentials: (existing ?? []).map((item) => ({
      id: item.credential_id,
      transports: item.transports as AuthenticatorTransport[],
    })),
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
  });
  await setPasskeyChallenge(PASSKEY_REGISTRATION_COOKIE, options.challenge);
  return NextResponse.json(options);
}
