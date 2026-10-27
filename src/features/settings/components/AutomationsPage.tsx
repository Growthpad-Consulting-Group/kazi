import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { isPathAllowed } from "@/lib/page-access";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import SetPageHeader from "@/components/ui/SetPageHeader";
import AutomationsClient from "./AutomationsClient";
import { EditableArea, ViewOnlyNotice } from "./EditableArea";
import type { AutomationRule } from "@/types/database";

type RuleRunSummary = { ruleId: string; lastRunAt: string; runCount: number };

export default async function AutomationsPage() {
  const session = await getServerSession(authOptions);
  if (!session || !isPathAllowed(session.user.allowedPaths, "/settings/automations")) {
    redirect("/settings/profile");
  }
  const canEdit = can(session.user.role, "manage_automations");

  const [{ data }, { data: executions }] = await Promise.all([
    supabaseAdmin.from("automation_rules").select("*").order("created_at", { ascending: false }),
    supabaseAdmin
      .from("automation_rule_executions")
      .select("rule_id, created_at")
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  const rules = (data ?? []) as AutomationRule[];
  const runMap = new Map<string, RuleRunSummary>();
  for (const execution of executions ?? []) {
    const existing = runMap.get(execution.rule_id);
    runMap.set(execution.rule_id, {
      ruleId: execution.rule_id,
      lastRunAt: existing?.lastRunAt ?? execution.created_at,
      runCount: (existing?.runCount ?? 0) + 1,
    });
  }

  return (
    <div className="space-y-6">
      <SetPageHeader
        title="Automations"
        description="Trigger notifications and rewards automatically"
        icon="solar:bolt-circle-broken"
      />
      {!canEdit && <ViewOnlyNotice permissionLabel="automation management" />}
      <EditableArea canEdit={canEdit}>
        <AutomationsClient initial={rules} runSummaries={[...runMap.values()]} />
      </EditableArea>
    </div>
  );
}
