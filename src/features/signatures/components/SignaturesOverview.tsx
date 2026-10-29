import Link from "next/link";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { getServerSession } from "next-auth";
import SetPageHeader from "@/components/ui/SetPageHeader";
import StatCard from "@/components/ui/StatCard";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { RoleTitleEditor } from "./RoleTitleEditor";
import { sanitizeSignatureHtml } from "@/features/signatures/lib/sanitizeSignatureHtml";

type QueryResult = {
  data: unknown;
  count: number | null;
  error: { message: string } | null;
};
type Database = {
  from: (table: string) => {
    select: (
      columns: string,
      options?: { count: "exact"; head?: boolean },
    ) => PromiseLike<QueryResult>;
  };
};
type Domain = {
  id: string;
  name: string;
  platform: string;
  gateway_status: string;
  spf_verified: boolean;
  dkim_verified: boolean;
};
type Assignment = { deploy_status: string; gmail_sync_status: string };
type StaffProfile = {
  id: string;
  user_id: string | null;
  email: string;
  full_name: string;
  role_title: string | null;
  department: string | null;
  photo_url: string | null;
};
type SignatureAssignment = { staff_profile_id: string; template_id: string };
type SignatureTemplate = { id: string; name: string; html: string };

function renderStaffSignature(html: string, profile: StaffProfile) {
  const escape = (value: string | null | undefined) =>
    (value ?? "").replace(
      /[&<>'"]/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[character] ?? character,
    );
  const values: Record<string, string | null | undefined> = {
    full_name: profile.full_name,
    email: profile.email,
    role_title: profile.role_title,
    department: profile.department,
    photo_url: profile.photo_url,
  };
  return sanitizeSignatureHtml(html).replace(
    /\{\{(full_name|email|role_title|department|photo_url)\}\}/g,
    (_match, key: string) => escape(values[key]),
  );
}

export default async function SignaturesOverview() {
  const session = await getServerSession(authOptions);
  const database = supabaseAdmin as unknown as Database;
  const canManage = Boolean(
    session && can(session.user.role, "manage_signatures"),
  );
  if (!canManage) {
    const [profiles, assignments, templates] = await Promise.all([
      database
        .from("signature_staff_profiles")
        .select(
          "id, user_id, email, full_name, role_title, department, photo_url",
        ),
      database
        .from("signature_assignments")
        .select("staff_profile_id, template_id"),
      database.from("signature_templates").select("id, name, html"),
    ]);
    for (const result of [profiles, assignments, templates])
      if (result.error) throw new Error(result.error.message);
    const profile = ((profiles.data ?? []) as StaffProfile[]).find(
      (row) => row.user_id === session?.user.id,
    );
    const assignment = profile
      ? ((assignments.data ?? []) as SignatureAssignment[]).find(
          (row) => row.staff_profile_id === profile.id,
        )
      : null;
    const template = assignment
      ? ((templates.data ?? []) as SignatureTemplate[]).find(
          (row) => row.id === assignment.template_id,
        )
      : null;
    return (
      <div className="space-y-6">
        <SetPageHeader
          title="My email signature"
          description="Your managed Growthpad identity for email."
          icon="solar:pen-new-square-broken"
        />
        {profile ? (
          <>
            <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-gradient-to-r from-brand-500/10 via-brand-500/5 to-transparent px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
                    <Icon
                      icon="solar:pen-new-square-broken"
                      className="h-5 w-5"
                    />
                  </span>
                  <div>
                    <h2 className="font-semibold text-[var(--text-hi)]">
                      Assigned signature
                    </h2>
                    <p className="text-xs text-[var(--text-lo)]">
                      {template
                        ? template.name
                        : "No template is assigned yet."}
                    </p>
                  </div>
                </div>
                {template && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                    <Icon
                      icon="solar:shield-check-broken"
                      className="h-3.5 w-3.5"
                    />
                    Managed by Kazi
                  </span>
                )}
              </div>
              <div className="space-y-5 p-5">
                <div className="flex items-start gap-4">
                  {profile.photo_url ? (
                    <Image
                      src={profile.photo_url}
                      alt=""
                      width={48}
                      height={48}
                      className="h-12 w-12 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-sm font-bold text-brand-500">
                      {profile.full_name
                        .split(" ")
                        .map((part) => part[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[var(--text-hi)]">
                      {profile.full_name}
                    </p>
                    <RoleTitleEditor initial={profile.role_title} />
                  </div>
                </div>
                {template ? (
                  <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                    <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-xs font-medium text-[var(--text-lo)]">
                      <Icon
                        icon="solar:letter-broken"
                        className="h-3.5 w-3.5"
                      />
                      Preview as it appears in email
                    </div>
                    <div
                      className="overflow-auto bg-white p-6 text-slate-900"
                      dangerouslySetInnerHTML={{
                        __html: renderStaffSignature(template.html, profile),
                      }}
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[var(--border)] px-5 py-10 text-center text-sm text-[var(--text-lo)]">
                    Your manager has not assigned a signature template yet.
                  </div>
                )}
              </div>
            </section>
          </>
        ) : (
          <section className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-14 text-center">
            <Icon
              icon="solar:pen-new-square-broken"
              className="mx-auto h-8 w-8 text-[var(--text-lo)]"
            />
            <h1 className="mt-3 font-semibold text-[var(--text-hi)]">
              Your signature is being prepared
            </h1>
            <p className="mt-1 text-sm text-[var(--text-lo)]">
              Contact your manager if your Growthpad email should be managed in
              Kazi.
            </p>
          </section>
        )}
      </div>
    );
  }
  const [staff, templates, domains, assignments] = await Promise.all([
    database
      .from("signature_staff_profiles")
      .select("id", { count: "exact", head: true }),
    database
      .from("signature_templates")
      .select("id", { count: "exact", head: true }),
    database
      .from("signature_domains")
      .select(
        "id, name, platform, gateway_status, spf_verified, dkim_verified",
      ),
    database
      .from("signature_assignments")
      .select("deploy_status, gmail_sync_status"),
  ]);
  for (const result of [staff, templates, domains, assignments])
    if (result.error) throw new Error(result.error.message);

  const domainRows = (domains.data ?? []) as Domain[];
  const assignmentRows = (assignments.data ?? []) as Assignment[];
  const deployed = assignmentRows.filter(
    (assignment) => assignment.deploy_status === "deployed",
  ).length;
  const needsAttention = assignmentRows.filter(
    (assignment) =>
      assignment.deploy_status === "error" ||
      assignment.gmail_sync_status === "error",
  ).length;
  const verifiedDomains = domainRows.filter(
    (domain) => domain.spf_verified && domain.dkim_verified,
  ).length;

  return (
    <div className="space-y-6">
      <SetPageHeader
        title="Kazi Signatures"
        description="Keep every Growthpad email on brand."
        icon="solar:letter-broken"
        actions={[
          {
            label: "New template",
            icon: "solar:add-circle-broken",
            variant: "primary",
            href: "/signatures/templates/new",
            write: true,
          },
          {
            label: "Signature staff",
            icon: "solar:users-group-rounded-broken",
            variant: "secondary",
            href: "/signatures/staff",
          },
          {
            label: "Campaigns",
            icon: "solar:flag-2-broken",
            variant: "secondary",
            href: "/signatures/campaigns",
          },
          {
            label: "Domains",
            icon: "solar:global-broken",
            variant: "secondary",
            href: "/signatures/domains",
          },
        ]}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Signature staff"
          value={staff.count ?? 0}
          icon="solar:users-group-rounded-broken"
          color="orange"
          variant="flat"
          compact
          href="/signatures/staff"
        />
        <StatCard
          title="Templates"
          value={templates.count ?? 0}
          icon="solar:document-text-broken"
          color="blue"
          variant="flat"
          compact
          href="/signatures/templates"
        />
        <StatCard
          title="Ready to deploy"
          value={deployed}
          icon="solar:rocket-2-broken"
          color="green"
          variant="flat"
          compact
          href="/signatures/staff?delivery=synced"
        />
        <StatCard
          title="Needs attention"
          value={needsAttention}
          icon="solar:danger-triangle-broken"
          color={needsAttention ? "amber" : "slate"}
          variant="flat"
          compact
          href="/signatures/staff?delivery=failed"
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-[var(--text-hi)]">
                Domain readiness
              </h2>
              <p className="mt-1 text-sm text-[var(--text-lo)]">
                Delivery configuration for your managed email domains.
              </p>
            </div>
            <span className="rounded-lg bg-brand-500/10 px-2.5 py-1 text-xs font-semibold text-brand-500">
              {verifiedDomains}/{domainRows.length} verified
            </span>
          </div>
          <div className="mt-5 space-y-3">
            {domainRows.map((domain) => {
              const ready = domain.spf_verified && domain.dkim_verified;
              return (
                <div
                  key={domain.id}
                  className="flex items-center justify-between gap-4 rounded-xl bg-[var(--surface-2)] px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${ready ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}
                    >
                      <Icon
                        icon="solar:global-broken"
                        className="h-4.5 w-4.5"
                      />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-hi)]">
                        {domain.name}
                      </p>
                      <p className="mt-0.5 text-xs capitalize text-[var(--text-lo)]">
                        {domain.platform.replaceAll("_", " ")}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${ready ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}
                  >
                    {ready ? "Verified" : "Setup needed"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
            <Icon icon="solar:shield-keyhole-broken" className="h-4.5 w-4.5" />
          </div>
          <h2 className="mt-4 font-semibold text-[var(--text-hi)]">
            Roll out with control
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-lo)]">
            Gmail delivery has passed a single-mailbox test. Review each staff
            profile and signature, then sync individual mailboxes as they are
            approved.
          </p>
          <Link
            href="/signatures/staff"
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-600"
          >
            Review staff{" "}
            <Icon icon="solar:arrow-right-broken" className="h-4 w-4" />
          </Link>
        </aside>
      </div>
    </div>
  );
}
