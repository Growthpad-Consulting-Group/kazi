import { supabaseAdmin } from "@/lib/supabase";
import {
  rankFollowThrough,
  type FollowThroughItem,
} from "./follow-through-rank";

export type { FollowThroughItem } from "./follow-through-rank";

/**
 * Open commitments the signed-in employee owns: action items from 1-on-1s
 * where they are the report, and open actions on their active development
 * plans. Only the action text and a link to the source are returned, so
 * manager-only notes stay with the 1-on-1 record.
 */
export async function loadFollowThrough(
  userId: string,
): Promise<{ items: FollowThroughItem[]; total: number }> {
  const [meetings, plans] = await Promise.all([
    supabaseAdmin
      .from("one_on_ones")
      .select("id, scheduled_at, action_items")
      .eq("report_id", userId)
      .order("scheduled_at", { ascending: false })
      .limit(12),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- idps is migration-backed; generated types lag
    (supabaseAdmin as any)
      .from("idps")
      .select("id, title, status, actions")
      .eq("user_id", userId)
      .eq("status", "active"),
  ]);

  const meetingItems: FollowThroughItem[] = (
    (meetings.data ?? []) as {
      id: string;
      scheduled_at: string | null;
      action_items: { text: string; done: boolean }[] | null;
    }[]
  ).flatMap((meeting) => {
    const label = meeting.scheduled_at
      ? new Date(meeting.scheduled_at).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          timeZone: "UTC",
        })
      : "Undated";
    return (meeting.action_items ?? [])
      .filter((item) => !item.done)
      .map((item, index) => ({
        id: `${meeting.id}:${index}`,
        text: item.text,
        source: `1-on-1 · ${label}`,
        href: `/pulse/one-on-ones/${meeting.id}`,
        dueAt: null,
      }));
  });

  const planItems: FollowThroughItem[] = (
    (plans.data ?? []) as {
      id: string;
      title: string;
      actions:
        { text: string; due_date: string | null; done: boolean }[] | null;
    }[]
  ).flatMap((plan) =>
    (plan.actions ?? [])
      .filter((action) => !action.done)
      .map((action, index) => ({
        id: `${plan.id}:${index}`,
        text: action.text,
        source: plan.title,
        href: "/pulse/idps",
        dueAt: action.due_date ? new Date(`${action.due_date}T23:59:59`) : null,
      })),
  );

  return rankFollowThrough([...planItems, ...meetingItems]);
}
