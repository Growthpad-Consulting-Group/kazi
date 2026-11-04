import { Icon } from "@iconify/react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import SetPageHeader from "@/components/ui/SetPageHeader";
import StatCard from "@/components/ui/StatCard";
import { VoiceOutForm } from "./VoiceOutForm";
import {
  VoiceOutQueue,
  type VoiceOutHandoff,
  type VoiceOutOwner,
  type VoiceOutReport,
} from "./VoiceOutQueue";
import { VoiceOutInsights, type VoiceOutInsight } from "./VoiceOutInsights";

export default async function VoiceOutPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const canManage = can(session.user.role, "manage_voice_out");
  const canViewInsights = can(session.user.role, "view_analytics");
  const [queueResult, insightResult, ownersResult] = await Promise.all([
    canManage
      ? supabaseAdmin
          .from("voice_out_reports")
          .select(
            "id, topic, message, status, priority, owner_id, internal_notes, attachments, allows_follow_up, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] }),
    canViewInsights
      ? supabaseAdmin
          .from("voice_out_reports")
          .select("topic, status, priority, sentiment, created_at")
      : Promise.resolve({ data: [] }),
    canManage
      ? supabaseAdmin
          .from("users")
          .select("id,name")
          .eq("is_active", true)
          .in("role", ["admin", "hr"])
          .order("name")
      : Promise.resolve({ data: [] }),
  ]);
  const data = queueResult.data;
  const reports = (data ?? []) as unknown as VoiceOutReport[];
  const reportIds = reports.map((report) => report.id);
  const { data: handoffRows } = reportIds.length
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed table awaits generated types
      await (supabaseAdmin as any)
        .from("voice_out_handoffs")
        .select(
          "id,report_id,from_owner_id,to_owner_id,created_by,note,created_at",
        )
        .in("report_id", reportIds)
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: [] };
  const handoffs = (handoffRows ?? []) as {
    id: string;
    report_id: string;
    from_owner_id: string | null;
    to_owner_id: string;
    created_by: string;
    note: string | null;
    created_at: string;
  }[];
  const handoffUserIds = [
    ...new Set(
      handoffs.flatMap((handoff) =>
        [handoff.from_owner_id, handoff.to_owner_id, handoff.created_by].filter(
          (id): id is string => !!id,
        ),
      ),
    ),
  ];
  const { data: handoffUsers } = handoffUserIds.length
    ? await supabaseAdmin
        .from("users")
        .select("id,name")
        .in("id", handoffUserIds)
    : { data: [] };
  const userNames = new Map(
    (handoffUsers ?? []).map((user) => [user.id, user.name]),
  );
  const handoffsByReport = new Map<string, VoiceOutHandoff[]>();
  for (const handoff of handoffs) {
    const item: VoiceOutHandoff = {
      id: handoff.id,
      from_owner_name: handoff.from_owner_id
        ? (userNames.get(handoff.from_owner_id) ?? "Former owner")
        : null,
      to_owner_name: userNames.get(handoff.to_owner_id) ?? "Assigned owner",
      created_by_name: userNames.get(handoff.created_by) ?? "HR team",
      note: handoff.note,
      created_at: handoff.created_at,
    };
    handoffsByReport.set(handoff.report_id, [
      ...(handoffsByReport.get(handoff.report_id) ?? []),
      item,
    ]);
  }
  for (const report of reports)
    report.handoffs = handoffsByReport.get(report.id) ?? [];
  const insights = (insightResult.data ?? []) as unknown as VoiceOutInsight[];
  const owners = (ownersResult.data ?? []) as VoiceOutOwner[];
  const open = reports.filter(
    (report) => report.status === "new" || report.status === "in_review",
  ).length;
  const urgent = reports.filter(
    (report) => report.priority === "high" || report.priority === "urgent",
  ).length;

  return (
    <>
      <SetPageHeader
        title="Voice Out"
        description={
          canManage
            ? "Review anonymous themes safely and follow up with care."
            : "Share what needs attention. Your name, account and staff record are not saved with this report. Avoid details that could identify you or others."
        }
        icon="solar:incognito-broken"
      />
      <div className="mx-auto max-w-7xl space-y-5">
        {canManage ? (
          <>
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                title="Open reports"
                value={open}
                icon="solar:chat-round-dots-broken"
                color={open ? "orange" : "slate"}
                compact
                subtitle="Need a response"
              />
              <StatCard
                title="Priority review"
                value={urgent}
                icon="solar:danger-triangle-broken"
                color={urgent ? "red" : "slate"}
                compact
                subtitle="High or urgent"
              />
              <StatCard
                title="Resolved"
                value={
                  reports.filter((report) => report.status === "resolved")
                    .length
                }
                icon="solar:check-circle-broken"
                color="green"
                compact
                subtitle="In this queue"
              />
              <StatCard
                title="Unassigned"
                value={
                  reports.filter(
                    (report) =>
                      !report.owner_id && report.status !== "archived",
                  ).length
                }
                icon="solar:user-block-broken"
                color="blue"
                compact
                subtitle="Needs an owner"
              />
            </section>
            <VoiceOutInsights reports={insights} />
            <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20">
              <div className="flex items-start gap-3 border-b border-[var(--border)] px-5 py-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                  <Icon icon="solar:shield-check-broken" className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-[var(--text-hi)]">
                    HR review queue
                  </h2>
                  <p className="mt-0.5 text-xs text-[var(--text-lo)]">
                    Do not attempt to identify a reporter. Handle themes and
                    follow-up through your agreed HR process.
                  </p>
                </div>
              </div>
              <VoiceOutQueue
                reports={reports}
                owners={owners}
                viewerId={session.user.id}
              />
            </section>
          </>
        ) : (
          <>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
              <VoiceOutForm />
              <aside className="self-start rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 lg:sticky lg:top-24">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                  <Icon icon="solar:shield-check-broken" className="h-4 w-4" />
                </span>
                <h2 className="mt-4 text-sm font-semibold text-[var(--text-hi)]">
                  How anonymity works
                </h2>
                <ul className="mt-3 space-y-3 text-xs leading-relaxed text-[var(--text-lo)]">
                  <li>
                    We do not save your account or staff ID with a report.
                  </li>
                  <li>The HR team sees the message, topic and date only.</li>
                  <li>
                    For immediate safety concerns, use your established
                    emergency or safeguarding channels.
                  </li>
                </ul>
              </aside>
            </div>
            {canViewInsights && <VoiceOutInsights reports={insights} />}
          </>
        )}
      </div>
    </>
  );
}
