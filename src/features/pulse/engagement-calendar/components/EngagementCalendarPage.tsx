import { Icon } from "@iconify/react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can, canView } from "@/lib/rbac";
import SetPageHeader from "@/components/ui/SetPageHeader";
import StatCard from "@/components/ui/StatCard";
import { supabaseAdmin } from "@/lib/supabase";
import { NewCampaignButton } from "@/features/pulse/campaigns/components/CampaignFormModal";
import { NewSideQuestButton } from "@/features/pulse/side-quests/components/SideQuestFormModal";
import { NewSurveyButton } from "@/features/pulse/surveys/components/NewSurveyButton";
import { ArchiveItemButton } from "./ArchiveItemButton";

type Item = { id: string; title: string; start: string | null; end: string | null; type: "Campaign" | "Survey" | "Side Quest"; href: string; status: string };
const styles = { Campaign: ["solar:flag-2-broken", "bg-brand-500/10 text-brand-500"], Survey: ["solar:chat-round-dots-broken", "bg-blue-500/10 text-blue-600"], "Side Quest": ["solar:cup-star-broken", "bg-amber-500/10 text-amber-700"] } as const;
const fmt = (value: string) => new Date(value).toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" });

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
    supabaseAdmin.from("recognition_campaigns").select("id,name,starts_at,ends_at,status"),
    supabaseAdmin.from("surveys").select("id,title,opens_at,closes_at,status"),
    supabaseAdmin.from("side_quests").select("id,title,starts_at,ends_at,status"),
    supabaseAdmin.from("recognition_values").select("id,name").eq("is_active", true),
    supabaseAdmin.from("departments").select("name").order("name"),
    supabaseAdmin.from("users").select("location").eq("is_active", true).not("location", "is", null),
    supabaseAdmin.from("users").select("id,name").eq("is_active", true).in("role", ["manager", "hr", "admin"]),
    supabaseAdmin.from("users").select("id,name").eq("is_active", true).order("name"),
    supabaseAdmin.from("staff_groups").select("id,name").order("name"),
  ]);

  const items: Item[] = [
    ...(campaigns ?? []).map((x) => ({ id: x.id, title: x.name, start: x.starts_at, end: x.ends_at, status: x.status, type: "Campaign" as const, href: "/pulse/campaigns" })),
    ...(surveys ?? []).map((x) => ({ id: x.id, title: x.title, start: x.opens_at, end: x.closes_at, status: x.status, type: "Survey" as const, href: `/pulse/surveys/${x.id}` })),
    ...(quests ?? []).map((x) => ({ id: x.id, title: x.title, start: x.starts_at, end: x.ends_at, status: x.status, type: "Side Quest" as const, href: "/pulse/side-quests" })),
  ].sort((a, b) => new Date(a.start ?? "9999-01-01").getTime() - new Date(b.start ?? "9999-01-01").getTime());

  const live = items.filter((item) => item.status === "live" || item.status === "active").length;

  const role = session?.user?.role;
  const canManageCampaigns = role ? can(role, "manage_recognition_campaigns") : false;
  const canManageQuests = role ? can(role, "manage_side_quests") : false;
  const canManageSurveys = role ? can(role, "manage_surveys") : false;

  const audienceOptions = {
    departments: (departments ?? []).map((d) => d.name).filter((n): n is string => n !== null),
    locations: [...new Set((locations ?? []).map((u) => u.location).filter((l): l is string => l !== null))],
    managers: (managers ?? []) as { id: string; name: string }[],
    staff: (staff ?? []) as { id: string; name: string }[],
  };

  const hasCreatePermission = canManageCampaigns || canManageQuests || canManageSurveys;

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
            {canManageCampaigns && <NewCampaignButton values={values ?? []} options={audienceOptions} />}
            {canManageQuests && <NewSideQuestButton options={audienceOptions} />}
            {canManageSurveys && <NewSurveyButton options={{ staff: audienceOptions.staff.map((person) => ({ ...person, department: null })), groups: (staffGroups ?? []) as { id: string; name: string }[], managers: audienceOptions.managers, departments: audienceOptions.departments }} size="sm" />}
          </div>
        )}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard compact title="Live now" value={live} icon="solar:bolt-broken" color={live ? "orange" : "slate"} subtitle="Activity in progress" />
          <StatCard compact title="Upcoming" value={items.filter((item) => item.start && new Date(item.start) > new Date()).length} icon="solar:calendar-add-broken" color="blue" subtitle="Scheduled ahead" />
          <StatCard compact title="Campaigns" value={items.filter((item) => item.type === "Campaign").length} icon="solar:flag-2-broken" color="amber" subtitle="Recognition moments" />
          <StatCard compact title="All activity" value={items.length} icon="solar:calendar-mark-broken" color="green" subtitle="Across Pulse" />
        </section>

        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-hi)]">Activity timeline</h2>
              <p className="mt-0.5 text-xs text-[var(--text-lo)]">Open an activity to manage it or review outcomes.</p>
            </div>
            <span className="rounded-lg bg-[var(--surface-2)] px-2 py-1 text-[10px] font-semibold text-[var(--text-lo)]">{items.length} items</span>
          </div>
          {items.length ? (
            <div className="p-3">
              {items.map((item) => {
                const [icon, tone] = styles[item.type];
                const pastDue = isPastDue(item);
                return (
                  <Link
                    key={`${item.type}-${item.id}`}
                    href={item.href}
                    className="group flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-[var(--surface-2)]"
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                      <Icon icon={icon} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-[var(--text-hi)]">{item.title}</p>
                        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${tone}`}>{item.type}</span>
                        {pastDue && (
                          <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-500 dark:bg-red-500/10">Past due</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-lo)]">
                        {item.start ? fmt(item.start) : "Unscheduled"}
                        {item.end ? ` · ends ${fmt(item.end)}` : ""}
                      </p>
                    </div>
                    <span className="rounded-md bg-[var(--surface-2)] px-2 py-1 text-[10px] font-semibold capitalize text-[var(--text-lo)]">{item.status}</span>
                    {pastDue ? (
                      <ArchiveItemButton id={item.id} type={item.type} />
                    ) : (
                      <Icon icon="solar:alt-arrow-right-broken" className="h-4 w-4 text-[var(--text-lo)] group-hover:text-brand-500" />
                    )}
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="px-5 py-20 text-center text-sm text-[var(--text-lo)]">No engagement activity is scheduled yet.</div>
          )}
        </section>
      </div>
    </>
  );
}
