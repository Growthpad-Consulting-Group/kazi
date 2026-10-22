import type { UserRole } from "@/types/database";

// ─── Role hierarchy ───────────────────────────────────────────────────────────
// Used by `hasRole` for "at least this level" checks.
const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin:          100,
  hr:              80,
  hiring_manager:  60,
  manager:         60,
  interviewer:     40,
  employee:        20,
};

export function hasRole(userRole: UserRole, required: UserRole | UserRole[]): boolean {
  const roles = Array.isArray(required) ? required : [required];
  return roles.some((r) => ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[r]);
}

// ─── Named permissions ────────────────────────────────────────────────────────
// Each permission names what a user is allowed to DO, not what role they have.
// Roles that appear in the set are allowed; the check is exact membership, not
// hierarchy — so "manager" does NOT inherit "hr" permissions automatically.
export type Permission =
  // People & org
  | "view_people"           // see the people directory
  | "manage_people"         // create / edit / deactivate staff profiles
  | "manage_roles"          // change another user's system role
  // Pulse
  | "view_own_pulse"        // see your own check-ins / goals / reviews
  | "manage_checkins"       // create check-ins for anyone; review them
  | "manage_goals"          // create / update / delete goals
  | "manage_surveys"        // create and publish engagement surveys
  | "manage_reviews"        // create review cycles; submit manager reviews
  | "manage_one_on_ones"    // schedule and manage 1-on-1 meetings
  | "manage_pips"           // create / manage performance improvement plans
  | "manage_idps"           // create / manage development plans
  // Analytics
  | "view_analytics"        // access the pulse analytics section
  // Hiring
  | "view_hiring"           // see the hiring pipeline
  | "manage_jobs"           // post / close jobs
  | "manage_hiring"         // broad hiring management (candidates + jobs)
  | "manage_candidates"     // move candidates, submit scores
  | "conduct_interviews"    // access interview kits
  // Signatures
  | "manage_signatures"     // manage email signature templates and assignments
  // Settings & admin
  | "access_settings"       // access the settings area
  | "manage_departments"    // add / rename / remove departments
  | "manage_system"         // system-wide settings, data retention, exports
  | "view_admin_cache"      // cache stats / monitoring
  | "search_people"         // search returns staff results
  | "search_hiring"         // search returns hiring results
  | "search_signatures";    // search returns signature results

// Which roles hold each permission.
const PERMISSION_MAP: Record<Permission, readonly UserRole[]> = {
  // People
  view_people:        ["admin", "hr", "manager"],
  manage_people:      ["admin", "hr"],
  manage_roles:       ["admin"],

  // Pulse — all roles have access to their own data; broader access below
  view_own_pulse:     ["admin", "hr", "manager", "hiring_manager", "interviewer", "employee"],
  manage_checkins:    ["admin", "hr", "manager"],
  manage_goals:       ["admin", "hr", "manager"],
  manage_surveys:     ["admin", "hr"],
  manage_reviews:     ["admin", "hr"],
  manage_one_on_ones: ["admin", "hr", "manager"],
  manage_pips:        ["admin", "hr", "manager"],
  manage_idps:        ["admin", "hr", "manager"],

  // Analytics
  view_analytics:     ["admin", "hr", "manager"],

  // Hiring
  view_hiring:        ["admin", "hr", "hiring_manager", "interviewer"],
  manage_jobs:        ["admin", "hr", "hiring_manager"],
  manage_hiring:      ["admin", "hr", "hiring_manager"],
  manage_candidates:  ["admin", "hr", "hiring_manager"],
  conduct_interviews: ["admin", "hr", "hiring_manager", "interviewer"],

  // Signatures
  manage_signatures:  ["admin", "hr"],

  // Settings
  access_settings:    ["admin", "hr"],
  manage_departments: ["admin", "hr"],
  manage_system:      ["admin", "hr"],
  view_admin_cache:   ["admin"],

  // Search
  search_people:      ["admin", "hr", "manager"],
  search_hiring:      ["admin", "hr", "hiring_manager", "interviewer"],
  search_signatures:  ["admin", "hr"],
};

/**
 * Check whether a role has a named permission.
 *
 * @example
 * can(session.user.role, "manage_goals")
 * can(session.user.role, ["manage_goals", "manage_checkins"])
 */
export function can(userRole: UserRole, permission: Permission | Permission[]): boolean {
  const perms = Array.isArray(permission) ? permission : [permission];
  return perms.some((p) => (PERMISSION_MAP[p] as readonly string[]).includes(userRole));
}

// ─── Role sets (for layout guards) ───────────────────────────────────────────
export const RECRUITMENT_ROLES: UserRole[] = ["admin", "hr", "hiring_manager", "interviewer"];
export const HR_ROLES: UserRole[]          = ["admin", "hr"];
export const ADMIN_ROLES: UserRole[]       = ["admin"];
export const PEOPLE_ROLES: UserRole[]      = ["admin", "hr", "manager"];
export const ANALYTICS_ROLES: UserRole[]   = ["admin", "hr", "manager"];
export const SETTINGS_ROLES: UserRole[]    = ["admin", "hr"];
export const DASHBOARD_ROLES: UserRole[]   = ["admin", "hr", "hiring_manager", "manager", "interviewer", "employee"];
