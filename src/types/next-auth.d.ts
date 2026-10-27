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
      /** Permissions an admin granted to this person on top of their role. */
      extraPermissions: string[];
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
