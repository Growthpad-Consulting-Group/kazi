"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateTables } from "@/lib/cache/invalidate";
import { can } from "@/lib/rbac";

/** Updates the signed-in user's own profile fields. */
export async function updateProfile(values: { name: string; email: string; job_title?: string | null; location?: string | null; avatar_url?: string | null }) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthenticated");

  const name = values.name.trim();
  const email = values.email.trim().toLowerCase();
  if (!name) throw new Error("Name is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address");

  const { data: clash } = await supabaseAdmin
    .from("users")
    .select("id")
    .ilike("email", email)
    .neq("id", session.user.id)
    .maybeSingle();
  if (clash) throw new Error("That email is already in use");

  const { error } = await supabaseAdmin
    .from("users")
    .update({
      name,
      email,
      ...(values.job_title !== undefined && { job_title: values.job_title?.trim() || null }),
      ...(values.location !== undefined && { location: values.location?.trim() || null }),
      ...(values.avatar_url !== undefined && { avatar_url: values.avatar_url?.trim() || null }),
    })
    .eq("id", session.user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/settings/profile");
  await invalidateTables("users");
  return { name, email };
}

/** Changes the signed-in user's own password. */
export async function changePassword(values: { current: string; next: string }) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthenticated");

  if (values.next.length < 8) throw new Error("New password must be at least 8 characters");
  if (values.next === values.current) throw new Error("New password must differ from the current one");

  const { data: user, error: findErr } = await supabaseAdmin
    .from("users")
    .select("password_hash")
    .eq("id", session.user.id)
    .single();
  if (findErr || !user) throw new Error("Account not found");

  const ok = await bcrypt.compare(values.current, user.password_hash);
  if (!ok) throw new Error("Current password is incorrect");

  const hash = await bcrypt.hash(values.next, 10);
  const { error } = await supabaseAdmin
    .from("users")
    .update({ password_hash: hash })
    .eq("id", session.user.id);
  if (error) throw new Error(error.message);

  return { ok: true };
}

// ─── Notification preferences ─────────────────────────────────────────────────

export interface NotifPrefs {
  checkin_reminders: boolean;
  checkin_submitted: boolean;
  goal_due_soon: boolean;
  goal_completed: boolean;
  review_cycle_started: boolean;
  review_submitted: boolean;
  one_on_one_scheduled: boolean;
  one_on_one_reminder: boolean;
  survey_published: boolean;
  campaign_updates: boolean;
  side_quest_updates: boolean;
  system_announcements: boolean;
}

export async function saveNotificationPrefs(prefs: NotifPrefs) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthenticated");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from("user_notification_preferences")
    .upsert({ user_id: session.user.id, ...prefs }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
  return { ok: true };
}

// ─── AI provider settings ─────────────────────────────────────────────────────

export async function saveAISettings(values: { provider: string; model: string; apiKey?: string }) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthenticated");
  if (!can(session.user.role, "manage_system")) throw new Error("Admin access required");

  if (!values.provider.trim()) throw new Error("Provider is required");
  if (!values.model.trim()) throw new Error("Model is required");

  const patch: Record<string, string> = { ai_provider: values.provider, ai_model: values.model };
  if (values.apiKey?.trim()) {
    patch.ai_api_key = values.apiKey.trim();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from("system_settings")
    .upsert({ key: "ai", ...patch }, { onConflict: "key" });
  if (error) throw new Error(error.message);
  revalidatePath("/settings/ai");
  return { ok: true };
}

// ─── Company settings ─────────────────────────────────────────────────────────

export interface CompanySettings {
  company_name: string | null;
  logo_url: string | null;
  website: string | null;
  industry: string | null;
  company_size: string | null;
  country: string | null;
  timezone: string;
  fiscal_year_start: number;
  culture_leaderboards_enabled: boolean;
}

export async function saveCompanySettings(values: CompanySettings) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthenticated");
  if (!can(session.user.role, "manage_system")) throw new Error("Admin access required");

  const str = (v: string | null) => v?.trim() || null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from("company_settings")
    .update({
      company_name: str(values.company_name),
      logo_url: str(values.logo_url),
      website: str(values.website),
      industry: str(values.industry),
      company_size: str(values.company_size),
      country: str(values.country),
      timezone: values.timezone || "Africa/Nairobi",
      fiscal_year_start: values.fiscal_year_start,
      culture_leaderboards_enabled: values.culture_leaderboards_enabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", "default");

  if (error) throw new Error(error.message);
  revalidatePath("/settings/overview");
  return { ok: true };
}

