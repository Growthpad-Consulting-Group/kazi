import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import SetPageHeader from "@/components/ui/SetPageHeader";
import NotificationsClient from "@/features/settings/components/NotificationsClient";
import type { NotifPrefs } from "@/features/settings/actions";

const DEFAULT_PREFS: NotifPrefs = {
  checkin_reminders: true,
  checkin_submitted: true,
  goal_due_soon: true,
  goal_completed: true,
  review_cycle_started: true,
  review_submitted: true,
  one_on_one_scheduled: true,
  one_on_one_reminder: true,
  survey_published: true,
  system_announcements: true,
};

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabaseAdmin as any)
    .from("user_notification_preferences")
    .select("*")
    .eq("user_id", session.user.id)
    .maybeSingle();

  const prefs: NotifPrefs = { ...DEFAULT_PREFS, ...(data ?? {}) };

  return (
    <div className="space-y-6">
      <SetPageHeader
        title="Notifications"
        description="Choose what you want to be notified about."
        icon="solar:bell-broken"
      />
      <NotificationsClient initial={prefs} />
    </div>
  );
}
