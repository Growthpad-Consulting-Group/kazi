import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getHireCompanyAccess,
  resolveHireWorkspace,
} from "@/lib/hire-company-access";

const HIRE_WORKSPACE_COOKIE = "kazi-hire-workspace";

/** Returns the authorised, active Hire company for a list/report request. */
export async function getActiveHireWorkspace(requestedSlug?: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthenticated");

  const access = await getHireCompanyAccess(session.user.id, session.user.role);
  const rememberedSlug = (await cookies()).get(HIRE_WORKSPACE_COOKIE)?.value;

  // An old cookie should never lock a person out after a company membership is
  // removed; an explicit URL from an unauthorised source still fails closed.
  let company;
  if (requestedSlug) {
    company = resolveHireWorkspace(access, requestedSlug);
  } else {
    try {
      company = resolveHireWorkspace(access, rememberedSlug);
    } catch {
      company = resolveHireWorkspace(access);
    }
  }

  return { session, access, company };
}
