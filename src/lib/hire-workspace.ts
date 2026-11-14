import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getHireCompanyAccess,
  resolveHireWorkspace,
} from "@/lib/hire-company-access";
import { ALL_HIRE_WORKSPACES } from "@/lib/hire-workspace-constants";

const HIRE_WORKSPACE_COOKIE = "kazi-hire-workspace";

export type ActiveHireWorkspace = {
  session: NonNullable<Awaited<ReturnType<typeof getServerSession>>>;
  access: Awaited<ReturnType<typeof getHireCompanyAccess>>;
  company: Awaited<ReturnType<typeof getHireCompanyAccess>>[number];
  companyIds: string[];
  isAggregate: boolean;
};

/** Returns the authorised, active Hire company for a list/report request. */
export async function getActiveHireWorkspace(requestedSlug?: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthenticated");

  const access = await getHireCompanyAccess(session.user.id, session.user.role);
  const rememberedSlug = (await cookies()).get(HIRE_WORKSPACE_COOKIE)?.value;
  const desiredSlug = requestedSlug ?? rememberedSlug;

  // Aggregate mode is deliberately opt-in and available only when someone has
  // more than one authorised company. It is a reporting/list context; creation
  // continues to require one concrete company.
  if (desiredSlug === ALL_HIRE_WORKSPACES && access.length > 1) {
    return {
      session,
      access,
      company: {
        companyId: "",
        slug: ALL_HIRE_WORKSPACES,
        displayName: "All authorised companies",
        role: "viewer" as const,
      },
      companyIds: access.map((entry) => entry.companyId),
      isAggregate: true,
    } satisfies ActiveHireWorkspace;
  }

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

  return {
    session,
    access,
    company,
    companyIds: [company.companyId],
    isAggregate: false,
  } satisfies ActiveHireWorkspace;
}
