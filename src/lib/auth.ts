import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";
import type { UserRole } from "@/types/database";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        const { data: user, error } = await supabaseAdmin
          .from("users")
          .select("id, email, name, password_hash, role, department, avatar_url, is_active")
          .eq("email", credentials.email.toLowerCase())
          .single();

        if (error || !user || !user.is_active) return null;

        const valid = await bcrypt.compare(credentials.password, user.password_hash);
        if (!valid) return null;

        // Fallback to signature staff photo if no avatar set
        let avatarUrl = user.avatar_url ?? null;
        if (!avatarUrl) {
          const { data: sig } = await supabaseAdmin
            .from("signature_staff_profiles")
            .select("photo_url")
            .eq("user_id", user.id)
            .maybeSingle();
          avatarUrl = (sig as { photo_url?: string | null } | null)?.photo_url ?? null;
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
        token.department = (user as unknown as { department: string | null }).department;
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
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};
