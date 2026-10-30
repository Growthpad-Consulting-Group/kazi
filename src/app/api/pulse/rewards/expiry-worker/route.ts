import { NextResponse } from "next/server";
import { hasCronAccess } from "@/lib/cron-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateUserNotifications } from "@/lib/cache/invalidate";

export async function POST(request: Request) {
  if (!hasCronAccess(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabaseAdmin.rpc(
    "expire_reward_points" as never,
  );
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  const expired = (data ?? []) as { user_id: string; expired_points: number }[];
  await Promise.all(
    expired.map(async ({ user_id, expired_points }) => {
      await supabaseAdmin.from("notifications").insert({
        user_id,
        message: `${expired_points} reward points expired after 12 months.`,
        link: "/pulse/rewards",
      });
      await invalidateUserNotifications(user_id);
    }),
  );
  const warningCutoff = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const lotsClient = supabaseAdmin.from(
    "reward_point_lots" as never,
  ) as unknown as {
    select: (columns: string) => {
      gt: (
        column: string,
        value: number,
      ) => {
        is: (
          column: string,
          value: null,
        ) => {
          is: (
            column: string,
            value: null,
          ) => {
            lte: (
              column: string,
              value: string,
            ) => Promise<{ data: unknown[] | null }>;
          };
        };
      };
    };
    update: (value: { expiry_notice_sent_at: string }) => {
      eq: (column: string, value: string) => Promise<unknown>;
    };
  };
  const { data: warningRows } = await lotsClient
    .select("id, user_id, remaining_points, expires_at")
    .gt("remaining_points", 0)
    .is("expired_at", null)
    .is("expiry_notice_sent_at", null)
    .lte("expires_at", warningCutoff);
  const warnings = (warningRows ?? []) as {
    id: string;
    user_id: string;
    remaining_points: number;
    expires_at: string;
  }[];
  await Promise.all(
    warnings.map(async (lot) => {
      const date = new Date(lot.expires_at).toLocaleDateString("en-KE", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      await supabaseAdmin.from("notifications").insert({
        user_id: lot.user_id,
        message: `${lot.remaining_points} reward points expire on ${date}. Redeem them before then.`,
        link: "/pulse/rewards",
      });
      await lotsClient
        .update({ expiry_notice_sent_at: new Date().toISOString() })
        .eq("id", lot.id);
      await invalidateUserNotifications(lot.user_id);
    }),
  );
  return NextResponse.json({
    expiredUsers: expired.length,
    expiredPoints: expired.reduce((sum, row) => sum + row.expired_points, 0),
    warningLots: warnings.length,
  });
}
