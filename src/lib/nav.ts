export type NavItem  = { href: string; icon: string; label: string };
export type NavGroup = { category: string; icon: string; items: NavItem[] };

export const sidebarNavGroups: NavGroup[] = [
  {
    category: "Home",
    icon: "solar:widget-2-broken",
    items: [
      { href: "/dashboard", icon: "solar:widget-2-broken",       label: "Dashboard" },
      { href: "/people",    icon: "solar:users-group-two-broken", label: "People" },
    ],
  },
  {
    category: "Kazi Hire",
    icon: "solar:case-minimalistic-broken",
    items: [
      { href: "/hire/jobs",       icon: "solar:case-minimalistic-broken", label: "Jobs" },
      { href: "/hire/candidates", icon: "solar:users-group-broken",       label: "Candidates" },
      { href: "/hire/pipeline",   icon: "solar:sort-horizontal-broken",   label: "Pipeline" },
      { href: "/hire/reporting",  icon: "solar:chart-broken",             label: "Reporting" },
    ],
  },
  {
    category: "Kazi Pulse",
    icon: "solar:pulse-broken",
    items: [
      { href: "/pulse",             icon: "solar:pulse-broken",                 label: "Pulse" },
      { href: "/pulse/checkins",    icon: "solar:checklist-broken",             label: "Check-ins" },
      { href: "/pulse/goals",       icon: "solar:target-broken",                label: "Goals" },
      { href: "/pulse/one-on-ones", icon: "solar:chat-round-dots-broken",       label: "1-on-1s" },
      { href: "/pulse/feedback",    icon: "solar:star-broken",                  label: "Feedback" },
      { href: "/pulse/reviews",     icon: "solar:clipboard-list-broken",        label: "Reviews" },
      { href: "/pulse/surveys",     icon: "solar:list-broken",                  label: "Surveys" },
      { href: "/pulse/idps",        icon: "solar:book-broken",                  label: "IDPs" },
      { href: "/pulse/pips",        icon: "solar:danger-triangle-broken",       label: "PIPs" },
      { href: "/pulse/analytics",   icon: "solar:graph-new-up-broken",          label: "Analytics" },
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
