import { Icon } from "@iconify/react";
import SettingsSection from "./SettingsSection";

interface RoleRow {
  role: string;
  label: string;
  description: string;
  permissions: string[];
  color: string;
  iconBg: string;
}

const ROLES: RoleRow[] = [
  {
    role: "admin",
    label: "Admin",
    description: "Full access to all features and system settings.",
    color: "text-red-500",
    iconBg: "bg-red-500/10 text-red-500",
    permissions: [
      "View & manage all staff",
      "Manage roles & permissions",
      "Manage all pulse features (check-ins, goals, reviews, surveys, 1-on-1s, PIPs, IDPs)",
      "View analytics",
      "Manage hiring pipeline & candidates",
      "Manage email signatures",
      "Access all settings",
      "Manage departments",
      "System settings & data management",
    ],
  },
  {
    role: "hr",
    label: "HR",
    description: "Staff operations — staff, pulse, hiring, and signatures.",
    color: "text-violet-500",
    iconBg: "bg-violet-500/10 text-violet-500",
    permissions: [
      "View & manage all staff",
      "Manage all pulse features",
      "View analytics",
      "Manage hiring pipeline & candidates",
      "Manage email signatures",
      "Access settings",
      "Manage departments",
      "System settings & data management",
    ],
  },
  {
    role: "manager",
    label: "Manager",
    description: "Oversees a team — check-ins, goals, and 1-on-1s for direct reports.",
    color: "text-blue-500",
    iconBg: "bg-blue-500/10 text-blue-500",
    permissions: [
      "View staff directory",
      "Own pulse data (check-ins, goals, reviews, 1-on-1s, PIPs, IDPs)",
      "View analytics",
      "Search staff",
    ],
  },
  {
    role: "hiring_manager",
    label: "Hiring Manager",
    description: "Manages job postings and the hiring pipeline.",
    color: "text-amber-500",
    iconBg: "bg-amber-500/10 text-amber-500",
    permissions: [
      "Own pulse data",
      "View & manage hiring pipeline",
      "Post and close jobs",
      "Manage candidates",
      "Conduct interviews",
    ],
  },
  {
    role: "interviewer",
    label: "Interviewer",
    description: "Participates in interview panels and submits scorecards.",
    color: "text-teal-500",
    iconBg: "bg-teal-500/10 text-teal-500",
    permissions: [
      "Own pulse data",
      "View hiring pipeline",
      "Access interview kits",
      "Submit interview scores",
    ],
  },
  {
    role: "employee",
    label: "Employee",
    description: "Standard team member — accesses their own data only.",
    color: "text-slate-500",
    iconBg: "bg-slate-500/10 text-slate-500",
    permissions: [
      "Own pulse data (check-ins, goals, reviews)",
    ],
  },
];

export default function RolesClient() {
  return (
    <div className="space-y-5">
      <SettingsSection
        title="Roles & Permissions"
        description="Read-only reference. Contact your administrator to change a user's role."
        icon="solar:shield-check-broken"
      >
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="bg-[var(--surface-2)] px-4 py-2.5 border-b border-[var(--border)]">
            <p className="text-xs text-[var(--text-lo)]">Roles are assigned per user. A user can hold one role at a time. Role changes take effect on next sign-in.</p>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {ROLES.map((r) => (
              <div key={r.role} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:gap-4">
                <div className="flex items-center gap-3 sm:w-40 sm:shrink-0">
                  <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${r.iconBg}`}>
                    {r.label.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <p className={`text-sm font-semibold ${r.color}`}>{r.label}</p>
                    <p className="text-xs text-[var(--text-lo)] hidden sm:block">{r.role}</p>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[var(--text-lo)] mb-2">{r.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {r.permissions.map((p) => (
                      <span key={p} className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--text-hi)]">
                        <Icon icon="solar:check-circle-broken" className="h-3 w-3 text-emerald-500 shrink-0" />
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="How to change roles"
        description="Role changes are made on individual employee profiles"
        icon="solar:user-check-broken"
        iconBg="bg-blue-500/10 text-blue-500"
      >
        <div className="flex items-start gap-3 text-sm text-[var(--text-lo)]">
          <Icon icon="solar:info-circle-broken" className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
          <p>Go to <strong className="text-[var(--text-hi)]">Staff → Employee profile → Role</strong> to change a staff member&apos;s role. Only admins can assign roles.</p>
        </div>
      </SettingsSection>
    </div>
  );
}
