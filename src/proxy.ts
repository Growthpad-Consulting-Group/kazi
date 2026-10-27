import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isPathAllowed } from "@/lib/page-access";
import { getAllowedPaths } from "@/lib/page-access-server";
import type { UserRole } from "@/types/database";

// Optimistic check on the signed session token. Pages still verify the session
// on the server, and API routes check their own permissions.
export async function proxy(request: NextRequest) {
  const token = await getToken({ req: request });
  // Signed-out visitors are sent to /login by the protected layouts.
  if (!token?.role) return NextResponse.next();

  const allowedPaths = await getAllowedPaths(token.role as UserRole);
  if (isPathAllowed(allowedPaths, request.nextUrl.pathname)) return NextResponse.next();

  return NextResponse.redirect(new URL("/pulse", request.url));
}

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|login).*)"],
};
