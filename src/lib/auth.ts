import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import {
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";
import { encryptGoogleToken } from "@/lib/google-calendar";
import { getAllowedPaths } from "@/lib/page-access-server";
import { withViewGrant } from "@/lib/page-access";
import { getExtraPermissions } from "@/lib/user-permissions";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";
import { verifyRecaptcha } from "@/lib/recaptcha";
import { highResGoogleProfilePhoto } from "@/lib/google-profile";
import type { UserRole } from "@/types/database";
import {
  PASSKEY_AUTHENTICATION_COOKIE,
  consumePasskeyChallenge,
  passkeyConfigFromOrigin,
} from "@/lib/passkeys";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleWorkspaceLoginEnabled = Boolean(
  googleClientId && googleClientSecret,
);

async function provisionGoogleWorkspaceConnection({
  userId,
  email,
  name,
  image,
  subject,
  accessToken,
  refreshToken,
  expiresAt,
}: {
  userId: string;
  email: string;
  name?: string | null;
  image?: string | null;
  subject: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: number | null;
}) {
  await supabaseAdmin
    .from("users")
    .update({
      ...(name?.trim() ? { name: name.trim() } : {}),
      ...(image ? { avatar_url: highResGoogleProfilePhoto(image) } : {}),
    })
    .eq("id", userId);

  await supabaseAdmin.from("google_profile_connections").upsert(
    {
      user_id: userId,
      google_subject: subject,
      google_email: email,
      refreshed_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (!accessToken) return;

  const { data: existing } = await supabaseAdmin
    .from("google_calendar_connections")
    .select("refresh_token_ciphertext")
    .eq("user_id", userId)
    .maybeSingle();
  const encryptedRefreshToken = refreshToken
    ? encryptGoogleToken(refreshToken)
    : existing?.refresh_token_ciphertext;

  // Google grants a refresh token on the consent flow. Preserve a previously
  // stored one if Google omits it on a later sign-in.
  if (!encryptedRefreshToken) return;
  await supabaseAdmin.from("google_calendar_connections").upsert(
    {
      user_id: userId,
      access_token_ciphertext: encryptGoogleToken(accessToken),
      refresh_token_ciphertext: encryptedRefreshToken,
      token_expiry: new Date(
        (expiresAt ?? Math.floor(Date.now() / 1000) + 3600) * 1000,
      ).toISOString(),
      calendar_id: "primary",
      calendar_name: email,
    },
    { onConflict: "user_id" },
  );
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        recaptchaToken: { label: "CAPTCHA token", type: "text" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials.password) return null;

        const email = credentials.email.toLowerCase().trim();
        const headers = new Headers(request?.headers ?? {});
        const [ipLimit, emailLimit] = await Promise.all([
          checkRateLimit({
            scope: "login-ip",
            identifier: requestIp(headers),
            limit: 10,
            windowSeconds: 15 * 60,
          }),
          checkRateLimit({
            scope: "login-email",
            identifier: email,
            limit: 5,
            windowSeconds: 15 * 60,
          }),
        ]);
        if (!ipLimit.allowed || !emailLimit.allowed) return null;
        if (!(await verifyRecaptcha(credentials.recaptchaToken, headers)))
          return null;

        const { data: user, error } = await supabaseAdmin
          .from("users")
          .select(
            "id, email, name, password_hash, role, department, avatar_url, is_active",
          )
          .eq("email", email)
          .single();

        if (error || !user || !user.is_active) return null;

        const valid = await bcrypt.compare(
          credentials.password,
          user.password_hash,
        );
        if (!valid) return null;

        // Fallback to signature staff photo if no avatar set
        let avatarUrl = user.avatar_url ?? null;
        if (!avatarUrl) {
          const { data: sig } = await supabaseAdmin
            .from("signature_staff_profiles")
            .select("photo_url")
            .eq("user_id", user.id)
            .maybeSingle();
          avatarUrl =
            (sig as { photo_url?: string | null } | null)?.photo_url ?? null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          department: user.department,
          image: avatarUrl,
        };
      },
    }),
    CredentialsProvider({
      id: "passkey",
      name: "Passkey",
      credentials: { response: { label: "Passkey response", type: "text" } },
      async authorize(credentials, request) {
        if (!credentials?.response || !request) return null;
        const challenge = await consumePasskeyChallenge(
          PASSKEY_AUTHENTICATION_COOKIE,
        );
        if (!challenge) return null;
        try {
          const response = JSON.parse(
            credentials.response,
          ) as AuthenticationResponseJSON;
          const db = supabaseAdmin as unknown as {
            from: (table: string) => {
              select: (columns: string) => {
                eq: (
                  column: string,
                  value: string,
                ) => {
                  maybeSingle: () => Promise<{
                    data: {
                      user_id: string;
                      credential_id: string;
                      public_key: string;
                      counter: number;
                      transports: string[];
                    } | null;
                  }>;
                };
              };
              update: (value: Record<string, unknown>) => {
                eq: (column: string, value: string) => Promise<unknown>;
              };
            };
          };
          const { data: passkey } = await db
            .from("passkeys")
            .select("user_id, credential_id, public_key, counter, transports")
            .eq("credential_id", response.id)
            .maybeSingle();
          if (!passkey) return null;
          const host = request.headers?.host ?? "localhost:3000";
          const proto = request.headers?.["x-forwarded-proto"] ?? "http";
          const config = passkeyConfigFromOrigin(
            process.env.NEXTAUTH_URL ?? `${proto}://${host}`,
          );
          const verification = await verifyAuthenticationResponse({
            response,
            expectedChallenge: challenge,
            expectedOrigin: config.origin,
            expectedRPID: config.rpID,
            credential: {
              id: passkey.credential_id,
              publicKey: Buffer.from(passkey.public_key, "base64url"),
              counter: passkey.counter,
              transports: passkey.transports,
            },
            requireUserVerification: true,
          });
          if (!verification.verified) return null;
          await db
            .from("passkeys")
            .update({
              counter: verification.authenticationInfo.newCounter,
              last_used_at: new Date().toISOString(),
            })
            .eq("credential_id", passkey.credential_id);
          const { data: user } = await supabaseAdmin
            .from("users")
            .select("id, email, name, role, department, avatar_url, is_active")
            .eq("id", passkey.user_id)
            .maybeSingle();
          if (!user?.is_active) return null;
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            department: user.department,
            image: user.avatar_url,
          };
        } catch (error) {
          console.error("Passkey sign-in failed", error);
          return null;
        }
      },
    }),
    ...(googleWorkspaceLoginEnabled
      ? [
          GoogleProvider({
            clientId: googleClientId!,
            clientSecret: googleClientSecret!,
            authorization: {
              params: {
                prompt: "consent",
                access_type: "offline",
                response_type: "code",
                // A work-account sign-in also creates the connection Kazi uses
                // for calendar events and internal Google Docs.
                scope:
                  "openid email profile https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive.readonly",
              },
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;
      const email = user.email?.toLowerCase().trim();
      const googleProfile = profile as { email_verified?: boolean } | undefined;
      if (
        !email ||
        !account.providerAccountId ||
        googleProfile?.email_verified !== true
      )
        return false;

      const { data: staff } = await supabaseAdmin
        .from("users")
        .select("id, is_active")
        .eq("email", email)
        .maybeSingle();
      if (!staff?.is_active) return false;

      try {
        await provisionGoogleWorkspaceConnection({
          userId: staff.id,
          email,
          name: user.name,
          image: user.image,
          subject: account.providerAccountId,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
        });
        return true;
      } catch (error) {
        console.error(
          "Google work-account sign-in could not be provisioned",
          error,
        );
        return false;
      }
    },
    async jwt({ token, user, account }) {
      if (user) {
        if (account?.provider === "google") {
          const { data: staff } = await supabaseAdmin
            .from("users")
            .select("id, role, department")
            .eq("email", user.email?.toLowerCase().trim() ?? "")
            .maybeSingle();
          if (staff) {
            token.id = staff.id;
            token.role = staff.role;
            token.department = staff.department;
          }
        } else {
          token.id = user.id;
          token.role = (user as unknown as { role: UserRole }).role;
          token.department = (
            user as unknown as { department: string | null }
          ).department;
        }
        token.picture = highResGoogleProfilePhoto(user.image);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.department = token.department as string | null;
        session.user.image = (token.picture as string | null) ?? null;
        session.user.extraPermissions = await getExtraPermissions(
          session.user.id,
        );
        session.user.allowedPaths = withViewGrant(
          await getAllowedPaths(session.user.role),
          session.user.extraPermissions,
        );
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};
