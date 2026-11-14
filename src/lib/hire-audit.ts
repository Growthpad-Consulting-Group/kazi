import { supabaseAdmin } from "@/lib/supabase";

type HireAuditEvent = {
  companyId: string;
  actorUserId: string | null;
  action: string;
  entityType: "job" | "candidate" | "scorecard";
  entityId: string;
  metadata?: Record<string, string | number | boolean | null>;
};

/**
 * Write non-sensitive Hire activity for company administrators. Never pass CV
 * content, email bodies, application answers or AI output in metadata.
 */
export async function recordHireAuditEvent(event: HireAuditEvent) {
  const { error } = await supabaseAdmin.from("hire_audit_events").insert({
    company_id: event.companyId,
    actor_user_id: event.actorUserId,
    action: event.action,
    entity_type: event.entityType,
    entity_id: event.entityId,
    metadata: event.metadata ?? {},
  });
  if (error) console.error("Could not record Hire audit event", error.message);
}
