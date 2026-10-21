export type NavItem  = { href: string; icon: string; label: string };
export type NavGroup = { category: string; icon: string; items: NavItem[] };

export const sidebarNavGroups: NavGroup[] = [
  {
    category: "Home",
    icon: "solar:widget-2-broken",
    items: [
      { href: "/dashboard", icon: "solar:widget-2-broken",       label: "Dashboard" },
      { href: "/people",    icon: "solar:user-id-broken",         label: "Staff" },
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
      { href: "/pulse/reviews",   icon: "solar:clipboard-list-broken",  label: "Performance" },
      { href: "/pulse/surveys",   icon: "solar:list-broken",            label: "Surveys" },
      { href: "/pulse/analytics", icon: "solar:graph-new-up-broken",    label: "Analytics" },
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
