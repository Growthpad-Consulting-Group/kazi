import { supabaseAdmin } from "@/lib/supabase";
import { pushSignatureToGmail } from "@/features/signatures/lib/gmailSync";
import { appendCampaignBanner } from "@/features/signatures/lib/campaignRenderer";
import { MAX_AUTOMATIC_SYNC_ATTEMPTS } from "@/features/signatures/lib/syncLimits";

export { MAX_AUTOMATIC_SYNC_ATTEMPTS };

type Result = { data?: unknown; error: { message: string } | null };
type Database = {
  from: (table: string) => {
    select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => PromiseLike<Result> } };
    update: (values: Record<string, unknown>) => { eq: (column: string, value: string) => PromiseLike<Result> };
  };
};

export type StaffSignatureSync =
  | { status: "synced" }
  | { status: "skipped" }
  | { status: "error"; message: string };

function render(html: string, profile: Record<string, unknown>) {
  return html.replace(/{{\s*([a-z_]+)\s*}}/gi, (_match, key: string) => String(profile[key] ?? ""));
}

/**
 * Re-renders one person's assigned signature and pushes it to their Gmail. Used whenever a
 * field that appears in the signature changes, so the mailbox stays in step with Kazi.
 * Someone with no assigned signature is skipped. Failures are recorded on the assignment.
 */
export async function syncStaffSignature(staffProfileId: string): Promise<StaffSignatureSync> {
  const database = supabaseAdmin as unknown as Database;

  const { data: profileData, error: profileError } = await database
    .from("signature_staff_profiles")
    .select("id, email, full_name, role_title, department, phone, mobile, photo_url")
    .eq("id", staffProfileId)
    .maybeSingle();
  if (profileError || !profileData) return { status: "error", message: profileError?.message ?? "Staff profile not found." };

  const { data: assignmentData, error: assignmentError } = await database
    .from("signature_assignments")
    .select("template_id")
    .eq("staff_profile_id", staffProfileId)
    .maybeSingle();
  if (assignmentError) return { status: "error", message: assignmentError.message };
  if (!assignmentData) return { status: "skipped" };
  const assignment = assignmentData as { template_id: string };

  const { data: templateData, error: templateError } = await database
    .from("signature_templates")
    .select("html")
    .eq("id", assignment.template_id)
    .maybeSingle();
  if (templateError || !templateData) return { status: "error", message: templateError?.message ?? "Template not found." };

  try {
    const profile = profileData as Record<string, unknown>;
    const signature = await appendCampaignBanner(
      render(String((templateData as { html: string }).html), profile),
      String(profile.email),
      String(profile.id),
      typeof profile.department === "string" ? profile.department : null,
      true
    );
    await pushSignatureToGmail(String(profile.email), signature);
    const { error } = await database
      .from("signature_assignments")
      .update({ gmail_sync_status: "synced", gmail_sync_error: null, gmail_sync_attempts: 0, last_gmail_synced_at: new Date().toISOString() })
      .eq("staff_profile_id", staffProfileId);
    if (error) throw new Error(error.message);
    return { status: "synced" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gmail sync failed.";
    const { data: counter } = await database
      .from("signature_assignments")
      .select("gmail_sync_attempts")
      .eq("staff_profile_id", staffProfileId)
      .maybeSingle();
    const attempts = ((counter as { gmail_sync_attempts?: number } | null)?.gmail_sync_attempts ?? 0) + 1;
    await database
      .from("signature_assignments")
      .update({ gmail_sync_status: "error", gmail_sync_error: message, gmail_sync_attempts: attempts })
      .eq("staff_profile_id", staffProfileId);
    return { status: "error", message };
  }
}
