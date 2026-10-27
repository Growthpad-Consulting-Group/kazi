import { supabaseAdmin } from "@/lib/supabase";

/** Keeps the signature photo in step with the person's Kazi photo. */
export async function syncSignaturePhoto(userId: string, url: string | null): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- signature_staff_profiles is not in the generated types
  const { error } = await (supabaseAdmin as any).from("signature_staff_profiles").update({ photo_url: url }).eq("user_id", userId);
  return error?.message ?? null;
}
