import { supabaseAdmin } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed table
const db = supabaseAdmin as any;

/**
 * Returns the Kazi user for a Slack member. When no link is saved yet, it reads the
 * member's work email from Slack and matches an active Kazi user with that email,
 * then saves the link. Requires the `users:read.email` bot scope. Returns null when
 * nothing matches, so the caller can ask the person to contact an admin.
 */
export async function resolveSlackLink(
  slackMemberId: string,
): Promise<{ user_id: string } | null> {
  if (!slackMemberId) return null;

  const { data: existing } = await db
    .from("slack_member_links")
    .select("user_id")
    .eq("slack_member_id", slackMemberId)
    .maybeSingle();
  if (existing) return existing as { user_id: string };

  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return null;

  const profileResponse = await fetch(
    `https://slack.com/api/users.info?user=${encodeURIComponent(slackMemberId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  ).catch(() => null);
  if (!profileResponse) return null;
  const profile = (await profileResponse.json().catch(() => null)) as {
    ok?: boolean;
    user?: { profile?: { email?: string } };
  } | null;
  const email = profile?.ok ? profile.user?.profile?.email?.trim() : "";
  if (!email) return null;

  const { data: match } = await db
    .from("users")
    .select("id")
    // Escape LIKE wildcards so an underscore in an address cannot match another user.
    .ilike(
      "email",
      email.replace(/[\\%_]/g, (char) => `\\${char}`),
    )
    .eq("is_active", true)
    .maybeSingle();
  if (!match) return null;

  await db
    .from("slack_member_links")
    .upsert(
      { user_id: match.id, slack_member_id: slackMemberId },
      { onConflict: "user_id" },
    );
  return { user_id: match.id };
}
