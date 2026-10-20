import { supabaseAdmin } from "@/lib/supabase";
import { invalidateUserNotifications } from "@/lib/cache/invalidate";
import type { UserRole } from "@/types/database";

export const RECRUITER_ROLES: UserRole[] = ["admin", "hr", "hiring_manager"];

export async function notifyRoles(
  roles: UserRole[],
  message: string,
  link: string | null
): Promise<void> {
  try {
    const { data: users } = await supabaseAdmin
      .from("users")
      .select("id")
      .in("role", roles)
      .eq("is_active", true);
    if (!users?.length) return;
    await supabaseAdmin
      .from("notifications")
      .insert(users.map((u) => ({ user_id: u.id, message, link })));
    // New notifications must be visible immediately, not after the TTL.
    // Only the recipients' own keys are evicted — other users keep theirs.
    await Promise.all(
      users.map((u) => invalidateUserNotifications(u.id as string))
    );
  } catch (err) {
    console.warn("Failed to create notification:", (err as Error).message);
  }
}
