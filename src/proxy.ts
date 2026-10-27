import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isPathAllowed, withViewGrant } from "@/lib/page-access";
import { getExtraPermissions } from "@/lib/user-permissions";
import { getAllowedPaths } from "@/lib/page-access-server";
import { mustChangePassword } from "@/lib/must-change-password";
import type { UserRole } from "@/types/database";

// Optimistic check on the signed session token. Pages still verify the session
// on the server, and API routes check their own permissions.
export async function proxy(request: NextRequest) {
  const token = await getToken({ req: request });
  // Signed-out visitors are sent to /login by the protected layouts.
  if (!token?.role) return NextResponse.next();

  // Someone with a temporary password can only use their profile until they choose a new one.
  const { pathname } = request.nextUrl;
  if (token.id && (await mustChangePassword(token.id as string)) && !pathname.startsWith("/settings/profile")) {
    return NextResponse.redirect(new URL("/settings/profile?passwordRequired=1", request.url));
  }

  const allowedPaths = withViewGrant(
    await getAllowedPaths(token.role as UserRole),
    token.id ? await getExtraPermissions(token.id as string) : [],
  );
  if (isPathAllowed(allowedPaths, pathname)) return NextResponse.next();

  return NextResponse.redirect(new URL("/pulse", request.url));
}

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|login).*)"],
};
