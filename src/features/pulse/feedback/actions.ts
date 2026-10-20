"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import {
  invalidatePublicFeedback,
  invalidateUserPrivateFeedback,
} from "@/lib/cache/invalidate";
import { getCachedPrivateFeedback, getCachedPublicFeedback } from "@/lib/cache/queries";
import type { Feedback, FeedbackVisibility } from "@/types/database";

export type FeedbackWithUsers = Feedback & {
  from: { name: string } | null;
  to: { name: string } | null;
};

export async function getPublicFeedback(limit = 20): Promise<FeedbackWithUsers[]> {
  return getCachedPublicFeedback(limit);
}

export async function getMyPrivateFeedback(userId: string): Promise<FeedbackWithUsers[]> {
  return getCachedPrivateFeedback(userId);
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
  // The recipient's private list changed; the public wall only if it was public.
  await invalidateUserPrivateFeedback(fields.to_user_id);
  if (fields.visibility === "public") await invalidatePublicFeedback();
}
