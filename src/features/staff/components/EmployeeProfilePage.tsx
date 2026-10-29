/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Icon } from "@iconify/react";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { STAFF_ROLES, can } from "@/lib/rbac";
import SetPageHeader from "@/components/ui/SetPageHeader";
import StatCard from "@/components/ui/StatCard";
import { supabaseAdmin } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { RoleSelector } from "./RoleSelector";
import EditStaffModal from "./EditStaffModal";
import GrantPointsModal from "./GrantPointsModal";
import { ResetPasswordButton } from "./ResetPasswordButton";
import { ExtraPermissionsControl } from "./ExtraPermissionsControl";
import type { UserRole } from "@/types/database";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  job_title: string | null;
  location: string | null;
  manager_id: string | null;
  start_date: string | null;
  date_of_birth: string | null;
  avatar_url: string | null;
};
type Signature = {
  id: string;
  role_title: string | null;
  status: string;
  email: string;
  photo_url: string | null;
};
type ProfileTab =
  "overview" | "pulse" | "performance" | "development" | "signature" | "access";
const tabs: { id: ProfileTab; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "solar:user-id-broken" },
  { id: "pulse", label: "Pulse", icon: "solar:heart-pulse-broken" },
  {
    id: "performance",
    label: "Performance",
    icon: "solar:chart-square-broken",
  },
  { id: "development", label: "Development", icon: "solar:course-up-broken" },
  { id: "signature", label: "Signature", icon: "solar:document-text-broken" },
  {
    id: "access",
    label: "Access",
    icon: "solar:key-minimalistic-square-broken",
  },
];

function dateLabel(date: string | null) {
  return date
    ? new Date(`${date}T12:00:00`).toLocaleDateString("en-KE", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Not set";
}
function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
}
function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-[var(--text-lo)]">{label}</dt>
      <dd className="text-right font-medium capitalize text-[var(--text-hi)]">
        {value}
      </dd>
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--text-lo)]">
      {children}
    </div>
  );
}

export default async function EmployeeProfilePage({
  id,
  tab,
}: {
  id: string;
  tab?: string;
}) {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user.role === "admin";
  const canManage = session
    ? ["admin", "hr"].includes(session.user.role)
    : false;
  const isSelf = session?.user.id === id;
  // Other people's pulse, performance and development records are for managers and HR.
  // Everyone else sees the overview of a colleague, and their own full profile.
  const seesAllTabs =
    (session ? STAFF_ROLES.includes(session.user.role) : false) || isSelf;
  // Access is for admins looking at someone else. Everyone else gets the overview of a colleague.
  const showAccessTab = canManage && !isSelf;
  const availableTabs = (
    seesAllTabs ? tabs : tabs.filter((item) => item.id === "overview")
  ).filter((item) => item.id !== "access" || showAccessTab);
  // The department workspace is limited to roles with manage_departments.
  const canOpenDepartment = session
    ? can(session.user.role, "manage_departments")
    : false;
  const { data: userData, error } = await supabaseAdmin
    .from("users")
    .select(
      "id, name, email, role, department, job_title, location, manager_id, start_date, date_of_birth, avatar_url",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!userData) notFound();
  const user = userData as User;
  const { data: grantRows } = await (supabaseAdmin as any)
    .from("user_permissions")
    .select("permission")
    .eq("user_id", id); // eslint-disable-line @typescript-eslint/no-explicit-any -- newer table
  const extraPermissions = ((grantRows ?? []) as { permission: string }[]).map(
    (row) => row.permission,
  );
  const activeTab: ProfileTab = availableTabs.some((item) => item.id === tab)
    ? (tab as ProfileTab)
    : "overview";
  const needsOverview = activeTab === "overview";
  const needsPulse = activeTab === "pulse";
  const needsPerformance = activeTab === "performance";
  const needsCheckin = needsOverview || needsPulse || needsPerformance;
  const needsGoals = needsOverview || needsPulse || needsPerformance;
  const emptyList = Promise.resolve({ data: [], error: null });
  const emptyRecord = Promise.resolve({ data: null, error: null });
  const signatureDb = supabaseAdmin as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string,
        ) => {
          maybeSingle: () => PromiseLike<{
            data: unknown;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
  const [
    managersResult,
    departmentsResult,
    managerResult,
    checkinResult,
    goalsResult,
    meetingsResult,
    signatureResult,
    departmentResult,
    reviewsResult,
    idpsResult,
  ] = await Promise.all([
    canManage
      ? supabaseAdmin
          .from("users")
          .select("id, name")
          .eq("is_active", true)
          .neq("id", id)
          .order("name")
      : emptyList,
    canManage
      ? supabaseAdmin.from("departments").select("name").order("name")
      : emptyList,
    needsOverview && user.manager_id
      ? supabaseAdmin
          .from("users")
          .select("id, name, job_title")
          .eq("id", user.manager_id)
          .maybeSingle()
      : emptyRecord,
    needsCheckin
      ? supabaseAdmin
          .from("checkins")
          .select("id, week_start, mood, status")
          .eq("user_id", id)
          .order("week_start", { ascending: false })
          .limit(1)
      : emptyList,
    needsGoals
      ? supabaseAdmin
          .from("goals")
          .select("id, title, progress, status")
          .eq("owner_id", id)
          .order("updated_at", { ascending: false })
          .limit(4)
      : emptyList,
    needsOverview
      ? supabaseAdmin
          .from("one_on_ones")
          .select("id, manager_id, report_id, scheduled_at")
          .order("scheduled_at", { ascending: true })
      : emptyList,
    signatureDb
      .from("signature_staff_profiles")
      .select("id, role_title, status, email, photo_url")
      .eq("user_id", id)
      .maybeSingle(),
    user.department
      ? supabaseAdmin
          .from("departments")
          .select("id")
          .eq("name", user.department)
          .maybeSingle()
      : emptyRecord,
    needsPerformance
      ? supabaseAdmin
          .from("performance_reviews")
          .select("id, overall_rating, submitted_at, review_type")
          .eq("reviewee_id", id)
          .order("updated_at", { ascending: false })
          .limit(1)
      : emptyList,
    activeTab === "development"
      ? supabaseAdmin
          .from("idps")
          .select("id, title, status, due_date")
          .eq("user_id", id)
          .order("updated_at", { ascending: false })
          .limit(1)
      : emptyList,
  ]);
  for (const result of [
    managersResult,
    departmentsResult,
    managerResult,
    checkinResult,
    goalsResult,
    meetingsResult,
    signatureResult,
    departmentResult,
    reviewsResult,
    idpsResult,
  ])
    if (result.error) throw new Error(result.error.message);
  const managers = managersResult.data ?? [];
  const departments = Array.from(
    new Set([
      ...(departmentsResult.data ?? []).map((item) => item.name),
      ...(user.department ? [user.department] : []),
    ]),
  ).sort();
  const manager = managerResult.data as { name: string } | null;
  const checkin = (checkinResult.data ?? [])[0] as
    { week_start: string; mood: number | null; status: string } | undefined;
  const goals = goalsResult.data ?? [];
  const meeting = (meetingsResult.data ?? []).find(
    (item) =>
      (item.manager_id === id || item.report_id === id) && item.scheduled_at,
  );
  const signature = signatureResult.data as Signature | null;
  const review = (reviewsResult.data ?? [])[0] as
    | {
        overall_rating: number | null;
        submitted_at: string | null;
        review_type: string;
      }
    | undefined;
  const idp = (idpsResult.data ?? [])[0] as
    { title: string; status: string; due_date: string | null } | undefined;
  const href = (value: ProfileTab) =>
    value === "overview"
      ? `/staff/${user.id}`
      : `/staff/${user.id}?tab=${value}`;
  const avatarUrl = user.avatar_url ?? signature?.photo_url;
  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const onboarding = [
    ["Manager", Boolean(user.manager_id)],
    ["Department", Boolean(user.department)],
    ["Start date", Boolean(user.start_date)],
    ["Check-in", Boolean(checkin)],
    ["Goal", goals.length > 0],
    ["Signature", Boolean(signature)],
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <SetPageHeader
        title={user.name}
        description={`${user.job_title ?? "Staff member"}${user.department ? ` · ${user.department}` : ""}`}
        icon="solar:user-id-broken"
        trailing={
          <>
            {departmentResult.data && canOpenDepartment && (
              <Button
                href={`/departments/${(departmentResult.data as { id: string }).id}`}
                size="sm"
                variant="secondary"
                icon="solar:buildings-broken"
              >
                Department
              </Button>
            )}
            <Button
              href="/staff"
              size="sm"
              variant={
                canManage || (departmentResult.data && canOpenDepartment)
                  ? "secondary"
                  : "primary"
              }
              icon="solar:arrow-left-broken"
            >
              Back to staff
            </Button>
            {canManage ? (
              <>
                <EditStaffModal
                  userId={user.id}
                  initial={{
                    name: user.name,
                    email: user.email,
                    job_title: user.job_title,
                    department: user.department,
                    location: user.location,
                    manager_id: user.manager_id,
                    start_date: user.start_date,
                    date_of_birth: user.date_of_birth,
                    avatar_url: user.avatar_url,
                    role: user.role as UserRole,
                  }}
                  managers={managers}
                  departments={departments}
                  canManageSystemAccess={isAdmin}
                  isSelf={isSelf}
                  avatarFallbackUrl={signature?.photo_url}
                />
                <GrantPointsModal userId={user.id} userName={user.name} />
              </>
            ) : null}
          </>
        }
      />
      <section className="relative overflow-hidden rounded-3xl border border-brand-500/20 bg-gradient-to-br from-[#2b1108] via-[#1d1411] to-[var(--surface)] p-6 shadow-xl shadow-brand-500/5 sm:p-7">
        <div className="pointer-events-none absolute -right-12 -top-14 h-48 w-48 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/10 text-lg font-bold text-orange-200">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold capitalize text-orange-200/65">
                Staff profile
              </p>
              <h1 className="mt-1 truncate text-2xl font-bold text-white">
                {user.name}
              </h1>
              <p className="mt-1 truncate text-sm text-white/60">
                {user.email}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {seesAllTabs && (
              <>
                <Link
                  href={`/pulse/checkins?user=${user.id}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-[#2b1108]"
                >
                  <Icon
                    icon="solar:clipboard-check-broken"
                    className="h-4 w-4"
                  />
                  Check-ins
                </Link>
                <Link
                  href={`/pulse/one-on-ones?report=${user.id}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white"
                >
                  <Icon
                    icon="solar:chat-round-dots-broken"
                    className="h-4 w-4"
                  />
                  1-on-1s
                </Link>
              </>
            )}
          </div>
        </div>
      </section>
      <nav
        aria-label="Staff profile workspaces"
        className="flex gap-1 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 text-sm"
      >
        {availableTabs.map((item) => (
          <Link
            key={item.id}
            href={href(item.id)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 font-medium transition-colors ${activeTab === item.id ? "bg-brand-500 text-white shadow-sm" : "text-[var(--text-hi)] hover:bg-[var(--surface-2)]"}`}
          >
            <Icon icon={item.icon} className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      {activeTab === "overview" && (
        <div className="space-y-5">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Check-in"
              value={checkin ? checkin.status : "None"}
              icon="solar:clipboard-check-broken"
              color={checkin?.status === "reviewed" ? "green" : "orange"}
              variant="flat"
              compact
              href={`/pulse/checkins?user=${user.id}`}
            />
            <StatCard
              title="Active goals"
              value={goals.filter((goal) => goal.status !== "completed").length}
              icon="solar:flag-broken"
              color="blue"
              variant="flat"
              compact
              href={`/pulse/checkins?tab=goals&user=${user.id}`}
            />
            <StatCard
              title="Scheduled 1-on-1"
              value={
                meeting?.scheduled_at
                  ? new Date(meeting.scheduled_at).toLocaleDateString("en-KE", {
                      day: "numeric",
                      month: "short",
                    })
                  : "None"
              }
              icon="solar:chat-round-dots-broken"
              color="amber"
              variant="flat"
              compact
              href={`/pulse/one-on-ones?report=${user.id}`}
            />
            <StatCard
              title="Signature"
              value={signature ? "Ready" : "Not set"}
              icon="solar:document-text-broken"
              color={signature ? "green" : "slate"}
              variant="flat"
              compact
              href={
                signature
                  ? `/signatures/staff/${signature.id}`
                  : "/signatures/staff"
              }
            />
          </section>
          <div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]">
            <Card>
              <h2 className="font-semibold text-[var(--text-hi)]">
                Employment
              </h2>
              <dl className="mt-4 space-y-3 text-sm">
                <ProfileRow label="Title" value={user.job_title ?? "Not set"} />
                <ProfileRow
                  label="Department"
                  value={user.department ?? "Unassigned"}
                />
                <ProfileRow
                  label="Manager"
                  value={manager?.name ?? "Unassigned"}
                />
                <ProfileRow
                  label="Location"
                  value={user.location ?? "Not set"}
                />
                <ProfileRow
                  label="Start date"
                  value={dateLabel(user.start_date)}
                />
              </dl>
            </Card>
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-[var(--text-hi)]">
                    Onboarding readiness
                  </h2>
                  <p className="mt-1 text-sm text-[var(--text-lo)]">
                    The core staff handoffs.
                  </p>
                </div>
                <span className="font-mono text-sm font-bold text-brand-500">
                  {onboarding.filter(([, done]) => done).length}/
                  {onboarding.length}
                </span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {onboarding.map(([label, done]) => (
                  <span
                    key={String(label)}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs ${done ? "bg-green-500/10 text-green-600" : "bg-[var(--surface-2)] text-[var(--text-lo)]"}`}
                  >
                    <Icon
                      icon={
                        done
                          ? "solar:check-circle-broken"
                          : "solar:clock-circle-broken"
                      }
                      className="h-3.5 w-3.5"
                    />
                    {label}
                  </span>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
      {activeTab === "pulse" && (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-[var(--text-hi)]">
                Goals and recent pulse
              </h2>
              <p className="mt-1 text-sm text-[var(--text-lo)]">
                Check-ins and commitments from Kazi Pulse.
              </p>
            </div>
            <Link
              href={`/pulse/checkins?user=${user.id}`}
              className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white"
            >
              View check-ins
            </Link>
          </div>
          <div className="mt-6 grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
            <div>
              {goals.length ? (
                <div className="space-y-3">
                  {goals.map((goal) => (
                    <div
                      key={goal.id}
                      className="rounded-xl bg-[var(--surface-2)] p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="min-w-0 truncate text-sm font-semibold text-[var(--text-hi)]">
                          {goal.title}
                        </p>
                        <span className="font-mono text-xs font-bold text-brand-500">
                          {goal.progress}%
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#f05d23] to-orange-400"
                          style={{ width: `${goal.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty>No individual goals yet.</Empty>
              )}
            </div>
            <div className="rounded-xl border border-[var(--border)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-lo)]">
                Latest check-in
              </p>
              {checkin ? (
                <>
                  <p className="mt-3 text-lg font-semibold capitalize text-[var(--text-hi)]">
                    {checkin.status}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-lo)]">
                    Week of {dateLabel(checkin.week_start)}
                  </p>
                  {checkin.mood ? (
                    <p className="mt-4 text-sm text-[var(--text-hi)]">
                      Mood signal: {checkin.mood}/5
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-3 text-sm text-[var(--text-lo)]">
                  No check-in submitted yet.
                </p>
              )}
            </div>
          </div>
        </Card>
      )}
      {activeTab === "performance" && (
        <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">
              Latest review
            </p>
            <h2 className="mt-2 text-xl font-bold capitalize text-[var(--text-hi)]">
              {review
                ? review.review_type.replaceAll("_", " ")
                : "No review recorded"}
            </h2>
            <p className="mt-2 text-sm text-[var(--text-lo)]">
              {review?.submitted_at
                ? `Submitted ${dateLabel(review.submitted_at.slice(0, 10))}`
                : "Start a cycle to capture feedback and outcomes."}
            </p>
            {review?.overall_rating ? (
              <p className="mt-6 text-4xl font-bold text-[var(--text-hi)]">
                {review.overall_rating}
                <span className="text-lg text-[var(--text-lo)]">/5</span>
              </p>
            ) : null}
          </Card>
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-[var(--text-hi)]">
                  Performance workspace
                </h2>
                <p className="mt-1 text-sm text-[var(--text-lo)]">
                  Reviews and goal signals are connected here.
                </p>
              </div>
              <Link
                href="/pulse/reviews"
                className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white"
              >
                Reviews
              </Link>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-[var(--surface-2)] p-4">
                <p className="text-xs text-[var(--text-lo)]">Active goals</p>
                <p className="mt-2 text-lg font-bold text-[var(--text-hi)]">
                  {goals.filter((goal) => goal.status !== "completed").length}
                </p>
              </div>
              <div className="rounded-xl bg-[var(--surface-2)] p-4">
                <p className="text-xs text-[var(--text-lo)]">Latest check-in</p>
                <p className="mt-2 text-lg font-bold capitalize text-[var(--text-hi)]">
                  {checkin?.status ?? "None"}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
      {activeTab === "development" && (
        <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">
                  Development plan
                </p>
                <h2 className="mt-2 text-xl font-bold text-[var(--text-hi)]">
                  {idp?.title ?? "No active development plan"}
                </h2>
                <p className="mt-2 text-sm text-[var(--text-lo)]">
                  {idp
                    ? `Status: ${idp.status.replaceAll("_", " ")}${idp.due_date ? ` · Due ${dateLabel(idp.due_date)}` : ""}`
                    : "Development plans make learning commitments visible and accountable."}
                </p>
              </div>
              <Link
                href="/pulse/reviews?tab=idps"
                className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white"
              >
                Dev plans
              </Link>
            </div>
          </Card>
          <Card>
            <h2 className="font-semibold text-[var(--text-hi)]">
              Next conversation
            </h2>
            <p className="mt-2 text-sm text-[var(--text-lo)]">
              Use the next 1-on-1 to agree on outcomes, support, and a practical
              next step.
            </p>
            <Link
              href={`/pulse/one-on-ones?report=${user.id}`}
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-500"
            >
              Open 1-on-1s{" "}
              <Icon icon="solar:arrow-right-up-broken" className="h-4 w-4" />
            </Link>
          </Card>
        </div>
      )}
      {activeTab === "access" && showAccessTab && (
        <div className="space-y-5">
          <section className="grid gap-3 sm:grid-cols-3">
            <StatCard
              title="System role"
              value={user.role.replaceAll("_", " ")}
              icon="solar:shield-user-broken"
              color="orange"
              variant="inline"
              compact
              subtitle="Baseline access"
            />
            <StatCard
              title="Extra grants"
              value={extraPermissions.length}
              icon="solar:key-minimalistic-square-broken"
              color={extraPermissions.length ? "blue" : "slate"}
              variant="inline"
              compact
              subtitle={
                extraPermissions.length
                  ? "Additional permissions"
                  : "No exceptions"
              }
            />
            <StatCard
              title="Account recovery"
              value="Ready"
              icon="solar:key-broken"
              color="green"
              variant="inline"
              compact
              subtitle="Password can be reset"
            />
          </section>
          {isAdmin ? (
            <>
              <div className="grid gap-5 lg:grid-cols-2">
                <RoleSelector
                  userId={user.id}
                  currentRole={user.role as UserRole}
                  isSelf={isSelf}
                />
                <ExtraPermissionsControl
                  userId={user.id}
                  userName={user.name}
                  granted={extraPermissions}
                />
              </div>
              <Card>
                <PasswordReset name={user.name} userId={user.id} />
              </Card>
            </>
          ) : (
            <Card>
              <PasswordReset name={user.name} userId={user.id} />
            </Card>
          )}
        </div>
      )}
      {activeTab === "signature" && (
        <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">
              Kazi Signatures
            </p>
            <h2 className="mt-2 text-xl font-bold text-[var(--text-hi)]">
              {signature
                ? "Signature identity is ready"
                : "No signature identity yet"}
            </h2>
            <p className="mt-2 text-sm text-[var(--text-lo)]">
              {signature
                ? `${signature.email} · ${signature.status}`
                : "Create a signature profile to give this staff member a consistent managed signature."}
            </p>
            {signature && (
              <Link
                href={`/signatures/staff/${signature.id}`}
                className="mt-5 inline-flex rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white"
              >
                Open signature
              </Link>
            )}
          </Card>
          <Card>
            <h2 className="font-semibold text-[var(--text-hi)]">
              Identity details
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <ProfileRow
                label="Role title"
                value={signature?.role_title ?? user.job_title ?? "Not set"}
              />
              <ProfileRow
                label="Work email"
                value={signature?.email ?? user.email}
              />
              <ProfileRow
                label="Photo"
                value={avatarUrl ? "Available" : "Not set"}
              />
              <ProfileRow
                label="Start date"
                value={dateLabel(user.start_date)}
              />
            </dl>
          </Card>
        </div>
      )}
    </div>
  );
}

function PasswordReset({ name, userId }: { name: string; userId: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
          <Icon icon="solar:key-broken" className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text-hi)]">
            Password
          </p>
          <p className="text-xs text-[var(--text-lo)]">
            Give {name} a temporary password if they cannot sign in. They choose
            their own at their next sign-in.
          </p>
        </div>
      </div>
      <ResetPasswordButton userId={userId} userName={name} />
    </div>
  );
}
