// Client-safe. The grants themselves live in the role_page_access table and are read
// by page-access-server.ts. This file only holds the list of gated pages and the
// matching rule, so navigation, the settings shell and the proxy all share one check.

/** adminOnly pages are never granted to other roles; they are listed so the nav hides them too. */
export type GatedPage = { path: string; label: string; section: string; adminOnly?: boolean };

/** Pages whose access is granted per role. Paths not listed here are open to every signed-in user. */
export const GATED_PAGES: GatedPage[] = [
  { path: "/dashboard",                  label: "Dashboard",            section: "Home" },
  { path: "/hire",                       label: "Hiring (jobs & candidates)", section: "Kazi Hire" },
  { path: "/pulse/analytics",            label: "Analytics",            section: "Kazi Pulse" },
  { path: "/pulse/engagement-calendar",  label: "Engagement calendar",  section: "Kazi Pulse" },
  { path: "/signatures/templates",       label: "Signature templates",  section: "Kazi Signatures" },
  { path: "/signatures/staff",           label: "Signature staff",      section: "Kazi Signatures" },
  { path: "/signatures/campaigns",       label: "Signature campaigns",  section: "Kazi Signatures" },
  { path: "/signatures/domains",         label: "Signature domains",    section: "Kazi Signatures" },
  { path: "/settings/overview",          label: "Company & System",     section: "Settings" },
  { path: "/settings/departments",       label: "Departments",          section: "Settings" },
  { path: "/settings/staff-groups",      label: "Staff groups",         section: "Settings" },
  { path: "/settings/automations",       label: "Automations",          section: "Settings" },
  { path: "/settings/exports",           label: "Data exports",         section: "Settings" },
  { path: "/settings/data-retention",    label: "Data retention",       section: "Settings" },
  { path: "/settings/roles",             label: "Roles & permissions",  section: "Settings", adminOnly: true },
];

/** Admin is always granted everything, so grants are stored and listed for the other roles only. */
export const GRANTABLE_ROLES = ["hr", "manager", "hiring_manager", "interviewer", "employee"] as const;

const matchesPath = (pathname: string, route: string) =>
  pathname === route || pathname.startsWith(`${route}/`);

/**
 * True when the pathname is open to a user with these granted paths. A path inside a
 * gated page needs that page granted; the longest matching gated page wins. "*" means
 * everything, which is what admins get.
 */
export function isPathAllowed(allowedPaths: readonly string[], pathname: string): boolean {
  if (allowedPaths.includes("*")) return true;

  let gate: GatedPage | undefined;
  for (const page of GATED_PAGES) {
    if (matchesPath(pathname, page.path) && (!gate || page.path.length > gate.path.length)) gate = page;
  }
  if (!gate) return true;
  if (gate.adminOnly) return false;
  return allowedPaths.includes(gate.path);
}
