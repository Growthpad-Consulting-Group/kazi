import type { UserRole } from "@/types/database";
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string | null;
      role: UserRole;
      department: string | null;
      /** Pages this role may open, from role_page_access. ["*"] for admin. */
      allowedPaths: string[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    department: string | null;
  }
}
