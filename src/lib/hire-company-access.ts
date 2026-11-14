import { supabaseAdmin } from "@/lib/supabase";
import type { UserRole } from "@/types/database";

export type HireCompanyRole =
  | "company_admin"
  | "recruiter"
  | "hiring_manager"
  | "viewer";

export type HireCompanyAccess = {
  companyId: string;
  slug: string;
  displayName: string;
  role: HireCompanyRole | "global_admin";
};

/**
 * Resolves the one company currently in view. Hire intentionally does not
 * silently aggregate records from multiple companies: selecting a workspace
 * is required before jobs, candidates, pipeline, or reporting are queried.
 */
export function resolveHireWorkspace(
  access: HireCompanyAccess[],
  requestedSlug?: string | null,
): HireCompanyAccess {
  if (access.length === 0) throw new Error("Forbidden");

  if (requestedSlug) {
    const selected = access.find((company) => company.slug === requestedSlug);
    if (!selected) throw new Error("Forbidden");
    return selected;
  }

  // Keep the established parent-company workspace as the safe first view for
  // global admins, while company members naturally land in their only company.
  return access.find((company) => company.slug === "growthpad") ?? access[0];
}

const GLOBAL_HIRE_ROLES: readonly UserRole[] = ["admin", "hr"];

const HIRE_ROLE_RANK: Record<HireCompanyRole, number> = {
  viewer: 1,
  hiring_manager: 2,
  recruiter: 3,
  company_admin: 4,
};

function isGlobalHireAdmin(role: UserRole) {
  return GLOBAL_HIRE_ROLES.includes(role);
}

/**
 * Returns only the Hire companies the staff member may access. Application-wide
 * admins and HR retain access to all active companies; all other staff require
 * an active company membership.
 */
export async function getHireCompanyAccess(
  userId: string,
  userRole: UserRole,
): Promise<HireCompanyAccess[]> {
  if (isGlobalHireAdmin(userRole)) {
    const { data, error } = await supabaseAdmin
      .from("companies")
      .select("id, slug, display_name")
      .eq("is_active", true)
      .order("display_name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((company) => ({
      companyId: company.id,
      slug: company.slug,
      displayName: company.display_name,
      role: "global_admin" as const,
    }));
  }

  const { data, error } = await supabaseAdmin
    .from("company_memberships")
    .select("hire_role, companies!inner(id, slug, display_name, is_active)")
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("companies.is_active", true);
  if (error) throw new Error(error.message);

  return (data ?? []).flatMap((membership) => {
    const company = membership.companies as unknown as {
      id: string;
      slug: string;
      display_name: string;
    } | null;
    if (!company) return [];
    return [{
      companyId: company.id,
      slug: company.slug,
      displayName: company.display_name,
      role: membership.hire_role as HireCompanyRole,
    }];
  });
}

/** Server-side Hire data-access guard. Never rely on an active-company UI filter. */
export async function assertHireCompanyAccess({
  userId,
  userRole,
  companyId,
  minimumRole = "viewer",
}: {
  userId: string;
  userRole: UserRole;
  companyId: string;
  minimumRole?: HireCompanyRole;
}): Promise<HireCompanyAccess> {
  const access = await getHireCompanyAccess(userId, userRole);
  const company = access.find((entry) => entry.companyId === companyId);
  if (!company) throw new Error("Forbidden");
  if (
    company.role !== "global_admin" &&
    HIRE_ROLE_RANK[company.role] < HIRE_ROLE_RANK[minimumRole]
  ) {
    throw new Error("Forbidden");
  }
  return company;
}

async function companyForRecord(
  table: "jobs" | "candidates",
  id: string,
) {
  const { data, error } = await supabaseAdmin
    .from(table)
    .select("company_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.company_id) throw new Error("Not found");
  return data.company_id;
}

/** Resolve a job's company before authorising a detail/mutation route. */
export async function assertHireJobAccess({
  jobId,
  ...access
}: Omit<Parameters<typeof assertHireCompanyAccess>[0], "companyId"> & {
  jobId: string;
}) {
  return assertHireCompanyAccess({
    ...access,
    companyId: await companyForRecord("jobs", jobId),
  });
}

/** Resolve a candidate's company before authorising a detail/mutation route. */
export async function assertHireCandidateAccess({
  candidateId,
  ...access
}: Omit<Parameters<typeof assertHireCompanyAccess>[0], "companyId"> & {
  candidateId: string;
}) {
  return assertHireCompanyAccess({
    ...access,
    companyId: await companyForRecord("candidates", candidateId),
  });
}

/** Authorise a bulk candidate operation and reject mixed/unavailable companies. */
export async function assertHireCandidateBatchAccess({
  candidateIds,
  ...access
}: Omit<Parameters<typeof assertHireCompanyAccess>[0], "companyId"> & {
  candidateIds: string[];
}) {
  const uniqueIds = [...new Set(candidateIds)];
  const { data, error } = await supabaseAdmin
    .from("candidates")
    .select("id, company_id")
    .in("id", uniqueIds);
  if (error) throw new Error(error.message);
  if ((data ?? []).length !== uniqueIds.length) throw new Error("Not found");

  const companyIds = [...new Set((data ?? []).map((candidate) => candidate.company_id))];
  return Promise.all(
    companyIds.map((companyId) =>
      assertHireCompanyAccess({ ...access, companyId, minimumRole: access.minimumRole }),
    ),
  );
}

export function canManageHireCompany(
  role: HireCompanyRole | "global_admin",
) {
  return role === "global_admin" || HIRE_ROLE_RANK[role] >= HIRE_ROLE_RANK.recruiter;
}
