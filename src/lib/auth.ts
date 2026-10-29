import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";
import { getAllowedPaths } from "@/lib/page-access-server";
import { withViewGrant } from "@/lib/page-access";
import { getExtraPermissions } from "@/lib/user-permissions";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";
import { verifyRecaptcha } from "@/lib/recaptcha";
import type { UserRole } from "@/types/database";

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
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as unknown as { role: UserRole }).role;
        token.department = (
          user as unknown as { department: string | null }
        ).department;
        token.picture = user.image ?? null;
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
