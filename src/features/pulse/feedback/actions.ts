"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import type { Feedback, FeedbackVisibility } from "@/types/database";

export type FeedbackWithUsers = Feedback & {
  from: { name: string } | null;
  to: { name: string } | null;
};

export async function getPublicFeedback(limit = 20): Promise<FeedbackWithUsers[]> {
  const { data } = await supabaseAdmin
    .from("feedback")
    .select("*, from:from_user_id(name), to:to_user_id(name)")
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as FeedbackWithUsers[];
}

export async function getMyPrivateFeedback(userId: string): Promise<FeedbackWithUsers[]> {
  const { data } = await supabaseAdmin
    .from("feedback")
    .select("*, from:from_user_id(name), to:to_user_id(name)")
    .eq("to_user_id", userId)
    .eq("visibility", "private")
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as FeedbackWithUsers[];
}

export async function sendFeedback(fields: {
  from_user_id: string;
  to_user_id: string;
  message: string;
  visibility: FeedbackVisibility;
  emoji?: string;
}) {
  const { error } = await supabaseAdmin.from("feedback").insert(fields);
  if (error) throw new Error(error.message);
  revalidatePath("/pulse/feedback");
}
