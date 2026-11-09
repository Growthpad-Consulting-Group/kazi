import { Icon } from "@iconify/react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can, canView, userCan } from "@/lib/rbac";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { supabaseAdmin } from "@/lib/supabase";
import { NewCampaignButton } from "@/features/pulse/campaigns/components/CampaignFormModal";
import { NewSideQuestButton } from "@/features/pulse/side-quests/components/SideQuestFormModal";
import { NewSurveyButton } from "@/features/pulse/surveys/components/NewSurveyButton";
import { ArchiveItemButton } from "./ArchiveItemButton";
import {
  EngagementMonthCalendar,
  type EngagementCalendarItem,
} from "./EngagementMonthCalendar";

type Item = EngagementCalendarItem;

/** Returns true when an item is past due and not yet in a terminal state. */
function isPastDue(item: Item): boolean {
  if (!item.end) return false;
  if (["completed", "archived", "closed"].includes(item.status)) return false;
  return new Date(item.end) < new Date();
}

export default async function EngagementCalendarPage() {
  const session = await getServerSession(authOptions);
  if (!session || !canView(session.user, "view_people")) redirect("/pulse");

  const [
    { data: campaigns },
    { data: surveys },
    { data: quests },
    { data: values },
    { data: departments },
    { data: locations },
    { data: managers },
    { data: staff },
    { data: staffGroups },
  ] = await Promise.all([
    supabaseAdmin
      .from("recognition_campaigns")
      .select("id,name,starts_at,ends_at,status"),
    supabaseAdmin.from("surveys").select("id,title,opens_at,closes_at,status"),
    supabaseAdmin
      .from("side_quests")
      .select("id,title,starts_at,ends_at,status"),
    supabaseAdmin
      .from("recognition_values")
      .select("id,name")
      .eq("is_active", true),
    supabaseAdmin.from("departments").select("name").order("name"),
    supabaseAdmin
      .from("users")
      .select("location")
      .eq("is_active", true)
      .not("location", "is", null),
    supabaseAdmin
      .from("users")
      .select("id,name")
      .eq("is_active", true)
      .in("role", ["manager", "hr", "admin"]),
    supabaseAdmin
      .from("users")
      .select("id,name")
      .eq("is_active", true)
      .order("name"),
    supabaseAdmin.from("staff_groups").select("id,name").order("name"),
  ]);

  const items: Item[] = [
    ...(campaigns ?? []).map((x) => ({
      id: x.id,
      title: x.name,
      start: x.starts_at,
      end: x.ends_at,
      status: x.status,
      type: "Campaign" as const,
      href: "/pulse/campaigns",
    })),
    ...(surveys ?? []).map((x) => ({
      id: x.id,
      title: x.title,
      start: x.opens_at,
      end: x.closes_at,
      status: x.status,
      type: "Survey" as const,
      href: `/pulse/surveys/${x.id}`,
    })),
    ...(quests ?? []).map((x) => ({
      id: x.id,
      title: x.title,
      start: x.starts_at,
      end: x.ends_at,
      status: x.status,
      type: "Side Quest" as const,
      href: `/pulse/side-quests/${x.id}`,
    })),
  ].sort(
    (a, b) =>
      new Date(a.start ?? "9999-01-01").getTime() -
      new Date(b.start ?? "9999-01-01").getTime(),
  );

  const role = session?.user?.role;
  const canManageCampaigns = role
    ? can(role, "manage_recognition_campaigns")
    : false;
  const canManageQuests = session
    ? userCan(session.user, "manage_side_quests")
    : false;
  const canManageSurveys = role ? can(role, "manage_surveys") : false;

  const audienceOptions = {
    departments: (departments ?? [])
      .map((d) => d.name)
      .filter((n): n is string => n !== null),
    locations: [
      ...new Set(
        (locations ?? [])
          .map((u) => u.location)
          .filter((l): l is string => l !== null),
      ),
    ],
    managers: (managers ?? []) as { id: string; name: string }[],
    staff: (staff ?? []) as { id: string; name: string }[],
  };

  const hasCreatePermission =
    canManageCampaigns || canManageQuests || canManageSurveys;

  return (
    <>
      <SetPageHeader
        title="Engagement calendar"
        description="Plan every survey, campaign, and Side Quest from one clear timeline."
        icon="solar:calendar-broken"
      />
      <div className="mx-auto max-w-7xl space-y-5">
        {/* Create action buttons */}
        {hasCreatePermission && (
          <div className="flex flex-wrap gap-2">
            {canManageCampaigns && (
              <NewCampaignButton
                values={values ?? []}
                options={audienceOptions}
              />
            )}
            {canManageQuests && (
              <NewSideQuestButton options={audienceOptions} />
            )}
            {canManageSurveys && (
              <NewSurveyButton
                options={{
                  staff: audienceOptions.staff.map((person) => ({
                    ...person,
                    department: null,
                  })),
                  groups: (staffGroups ?? []) as { id: string; name: string }[],
                  managers: audienceOptions.managers,
                  departments: audienceOptions.departments,
                }}
                size="sm"
              />
            )}
          </div>
        )}

        <EngagementMonthCalendar items={items} />

        {items.some(isPastDue) && (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-5">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
                <Icon icon="solar:clock-circle-broken" className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-hi)]">
                  Needs scheduling attention
                </h2>
                <p className="text-xs text-[var(--text-lo)]">
                  Archive or update activity that has passed its end date.
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {items.filter(isPastDue).map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--surface-2)] px-2.5 py-1.5 text-xs text-[var(--text-hi)]"
                >
                  <span className="max-w-44 truncate font-medium">
                    {item.title}
                  </span>
                  <ArchiveItemButton id={item.id} type={item.type} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
