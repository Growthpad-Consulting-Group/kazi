import { awardPoints } from "@/lib/award-points";
import { supabaseAdmin } from "@/lib/supabase";
import type { AutomationTrigger } from "@/types/database";

type AudienceType = "company" | "department" | "location" | "manager_group" | "staff";

type ActiveStaff = {
  id: string;
  department: string | null;
  location: string | null;
  manager_id: string | null;
};

export async function getAutomationAudience(
  audienceType: AudienceType,
  audienceFilters: string[] | null,
): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id, department, location, manager_id")
    .eq("is_active", true);

  const staff = (data ?? []) as ActiveStaff[];
  const filters = Array.isArray(audienceFilters) ? audienceFilters : [];

  if (audienceType === "company") return staff.map((member) => member.id);

  return staff
    .filter((member) => {
      if (audienceType === "department") return member.department !== null && filters.includes(member.department);
      if (audienceType === "location") return member.location !== null && filters.includes(member.location);
      if (audienceType === "manager_group") return member.manager_id !== null && filters.includes(member.manager_id);
      return filters.includes(member.id);
    })
    .map((member) => member.id);
}

type AutomationEvent = {
  trigger: AutomationTrigger;
  eventKey: string;
  recipientIds: string[];
  notification: (userId: string) => Promise<void>;
  pointReason: string;
  referenceId: string;
};

/** Executes matching active rules once per event and recipient. */
export async function runAutomationEvent(event: AutomationEvent): Promise<number> {
  const { data: rules, error: rulesError } = await supabaseAdmin
    .from("automation_rules")
    .select("id, action_type, config")
    .eq("is_active", true)
    .eq("trigger_type", event.trigger);

  if (rulesError || !rules?.length) return 0;

  let processed = 0;
  for (const rule of rules) {
    for (const userId of [...new Set(event.recipientIds)]) {
      const { error: claimError } = await supabaseAdmin
        .from("automation_rule_executions")
        .insert({ rule_id: rule.id, event_key: event.eventKey, user_id: userId, action_type: rule.action_type });

      if (claimError?.code === "23505" || claimError) continue;

      try {
        if (rule.action_type === "send_notification") {
          await event.notification(userId);
        } else {
          const configuredPoints = Number((rule.config as Record<string, unknown>)?.points);
          const amount = Number.isFinite(configuredPoints) && configuredPoints > 0
            ? Math.min(Math.floor(configuredPoints), 10_000)
            : 50;
          await awardPoints({
            userId,
            amount,
            reason: event.pointReason,
            referenceType: "automation",
            referenceId: event.referenceId,
            createdBy: null,
          });
        }
        processed += 1;
      } catch {
        // Permit a later run to recover if the side effect failed.
        await supabaseAdmin.from("automation_rule_executions").delete()
          .eq("rule_id", rule.id).eq("event_key", event.eventKey).eq("user_id", userId);
      }
    }
  }

  return processed;
}
