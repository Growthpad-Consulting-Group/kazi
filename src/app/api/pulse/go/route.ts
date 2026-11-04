import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  isSafePulsePath,
  KNOWN_KINDS,
  type QueueScope,
} from "@/features/pulse/measurement";

// Records that a Pulse prompt was used, then continues to its destination.
// Only the kind and time are stored; the person who clicked is not recorded.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") as QueueScope | null;
  const kind = url.searchParams.get("kind") ?? "";
  const to = url.searchParams.get("to") ?? "";

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.redirect(new URL("/login", request.url));

  if (
    !scope ||
    !Object.prototype.hasOwnProperty.call(KNOWN_KINDS, scope) ||
    !KNOWN_KINDS[scope].includes(kind) ||
    !isSafePulsePath(to)
  )
    return NextResponse.redirect(new URL("/pulse", request.url));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed table
  await (supabaseAdmin as any)
    .from("pulse_link_clicks")
    .insert({ scope, kind })
    .then(
      () => undefined,
      (error: unknown) => console.error("[pulse-go] click not recorded", error),
    );

  return NextResponse.redirect(new URL(to, request.url));
}
