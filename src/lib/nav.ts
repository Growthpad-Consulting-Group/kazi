import type { UserRole } from "@/types/database";
import { can } from "@/lib/rbac";

export type NavItem  = { href: string; icon: string; label: string };
export type NavGroup = { category: string; icon: string; items: NavItem[] };

export const sidebarNavGroups: NavGroup[] = [
  {
    category: "Home",
    icon: "solar:widget-2-broken",
    items: [
      { href: "/dashboard", icon: "solar:widget-2-broken",       label: "Dashboard" },
      { href: "/staff",    icon: "solar:user-id-broken",         label: "Staff" },
    ],
  },
  {
    category: "Kazi Hire",
    icon: "solar:case-minimalistic-broken",
    items: [
      { href: "/hire/jobs",       icon: "solar:case-minimalistic-broken", label: "Jobs" },
      { href: "/hire/candidates", icon: "solar:user-speak-broken",        label: "Candidates" },
    ],
  },
  {
    category: "Kazi Pulse",
    icon: "solar:pulse-broken",
    items: [
      { href: "/pulse",           icon: "solar:pulse-broken",           label: "Pulse" },
      { href: "/pulse/checkins",  icon: "solar:checklist-broken",       label: "Engagement" },
      { href: "/pulse/feedback",  icon: "solar:star-broken",            label: "Feedback" },
      { href: "/pulse/campaigns", icon: "solar:flag-2-broken",          label: "Campaigns" },
      { href: "/pulse/side-quests", icon: "solar:cup-star-broken",      label: "Side Quests" },
      { href: "/pulse/leaderboards", icon: "solar:medal-ribbon-broken", label: "Leaderboards" },
      { href: "/pulse/hall-of-fame", icon: "solar:cup-star-broken",      label: "Hall of Fame" },
      { href: "/pulse/rewards",      icon: "solar:gift-broken",          label: "Rewards" },
      { href: "/pulse/engagement-calendar", icon: "solar:calendar-broken", label: "Engagement calendar" },
      { href: "/pulse/voice-out", icon: "solar:incognito-broken",       label: "Voice Out" },
      { href: "/pulse/reviews",   icon: "solar:clipboard-list-broken",  label: "Performance" },
      { href: "/pulse/surveys",   icon: "solar:list-broken",            label: "Surveys" },
      { href: "/pulse/analytics", icon: "solar:graph-new-up-broken",    label: "Analytics" },
    ],
  },
  {
    category: "Kazi Signatures",
    icon: "solar:letter-broken",
    items: [
      { href: "/signatures", icon: "solar:letter-broken", label: "Overview" },
      { href: "/signatures/templates", icon: "solar:document-text-broken", label: "Templates" },
      { href: "/signatures/staff", icon: "solar:users-group-rounded-broken", label: "Signature staff" },
      { href: "/signatures/campaigns", icon: "solar:flag-2-broken", label: "Campaigns" },
      { href: "/signatures/domains", icon: "solar:global-broken", label: "Domains" },
    ],
  },
  {
    category: "System",
    icon: "solar:settings-broken",
    items: [
      { href: "/settings", icon: "solar:settings-broken", label: "Settings" },
    ],
  },
];

/** Navigation is an affordance, not the access-control boundary. Protected
 * route layouts enforce the same rules for direct URLs. */
export function navigationForRole(role: UserRole | undefined): NavGroup[] {
  const isManager        = role ? can(role, "view_people") : false;
  const isRecruiter      = role ? can(role, "view_hiring") : false;
  const isSignatureManager = role ? can(role, "manage_signatures") : false;

  return sidebarNavGroups
    .map((group) => {
      if (group.category === "Home") return { ...group, items: group.items.filter((item) => (item.href !== "/staff" && item.href !== "/dashboard") || isManager) };
      if (group.category === "Kazi Hire") return { ...group, items: isRecruiter ? group.items : [] };
      if (group.category === "Kazi Pulse") return { ...group, items: group.items.filter((item) => (item.href !== "/pulse/analytics" && item.href !== "/pulse/engagement-calendar") || isManager) };
      if (group.category === "Kazi Signatures") return { ...group, items: isSignatureManager ? group.items : group.items.filter((item) => item.href === "/signatures") };
      if (group.category === "System") return group;
      return group;
    })
    .filter((group) => group.items.length > 0);
}
