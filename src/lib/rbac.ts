import type { UserRole } from "@/types/database";

const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 100,
  hr: 80,
  hiring_manager: 60,
  interviewer: 40,
  manager: 60,
  employee: 20,
};

export function hasRole(userRole: UserRole, required: UserRole | UserRole[]): boolean {
  const roles = Array.isArray(required) ? required : [required];
  return roles.some((r) => ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[r]);
}

// Roles that can access recruitment features
export const RECRUITMENT_ROLES: UserRole[] = ["admin", "hr", "hiring_manager", "interviewer"];
export const HR_ROLES: UserRole[] = ["admin", "hr"];
export const ADMIN_ROLES: UserRole[] = ["admin"];
