"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateOneOnOneParticipants } from "@/lib/cache/invalidate";
import { getCachedOneOnOnes } from "@/lib/cache/queries";
import type { OneOnOne } from "@/types/database";

export type OneOnOneWithUsers = OneOnOne & {
  manager: { name: string } | null;
  report: { name: string; job_title: string | null } | null;
};

export async function getOneOnOnes(params: {
  managerId?: string;
  reportId?: string;
}): Promise<OneOnOne[]> {
  return getCachedOneOnOnes(params);
}

export async function createOneOnOne(managerId: string, reportId: string, scheduledAt?: string) {
  const { data, error } = await supabaseAdmin
    .from("one_on_ones")
    .insert({ manager_id: managerId, report_id: reportId, scheduled_at: scheduledAt ?? null })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/pulse/one-on-ones");
  await invalidateOneOnOneParticipants({ managerId, reportId });
  return (data as unknown as { id: string }).id;
}

export async function updateOneOnOne(
  id: string,
  fields: { agenda?: string; notes?: string; action_items?: { text: string; done: boolean }[] }
) {
  const { error } = await supabaseAdmin.from("one_on_ones").update(fields).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/pulse/one-on-ones/${id}`);
  const participants = await oneOnOneParticipants(id);
  await invalidateOneOnOneParticipants(participants);
}

/** Look up the two participants of a one-on-one. */
async function oneOnOneParticipants(id: string): Promise<{
  managerId?: string;
  reportId?: string;
}> {
  const { data } = await supabaseAdmin
    .from("one_on_ones")
    .select("manager_id, report_id")
    .eq("id", id)
    .maybeSingle();
  const row = data as { manager_id: string | null; report_id: string | null } | null;
  return {
    managerId: row?.manager_id ?? undefined,
    reportId: row?.report_id ?? undefined,
  };
}
