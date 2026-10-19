"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import type { OneOnOne } from "@/types/database";

export type OneOnOneWithUsers = OneOnOne & {
  manager: { name: string } | null;
  report: { name: string; job_title: string | null } | null;
};

export async function getOneOnOnes(params: {
  managerId?: string;
  reportId?: string;
}): Promise<OneOnOne[]> {
  let q = supabaseAdmin.from("one_on_ones").select("*").order("scheduled_at", { ascending: false });
  if (params.managerId) q = q.eq("manager_id", params.managerId);
  if (params.reportId) q = q.eq("report_id", params.reportId);
  const { data } = await q;
  return (data ?? []) as unknown as OneOnOne[];
}

export async function createOneOnOne(managerId: string, reportId: string, scheduledAt?: string) {
  const { data, error } = await supabaseAdmin
    .from("one_on_ones")
    .insert({ manager_id: managerId, report_id: reportId, scheduled_at: scheduledAt ?? null })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/pulse/one-on-ones");
  return (data as unknown as { id: string }).id;
}

export async function updateOneOnOne(
  id: string,
  fields: { agenda?: string; notes?: string; action_items?: { text: string; done: boolean }[] }
) {
  const { error } = await supabaseAdmin.from("one_on_ones").update(fields).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/pulse/one-on-ones/${id}`);
}
