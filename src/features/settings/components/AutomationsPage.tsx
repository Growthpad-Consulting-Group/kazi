import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import SetPageHeader from "@/components/ui/SetPageHeader";
import AutomationsClient from "./AutomationsClient";
import type { AutomationRule } from "@/types/database";

export default async function AutomationsPage() {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_automations")) {
    redirect("/settings");
  }

  const { data } = await supabaseAdmin
    .from("automation_rules")
    .select("*")
    .order("created_at", { ascending: false });

  const rules = (data ?? []) as AutomationRule[];

  return (
    <div className="space-y-6">
      <SetPageHeader
        title="Automations"
        description="Trigger notifications and rewards automatically"
        icon="solar:bolt-circle-broken"
      />
      <AutomationsClient initial={rules} />
    </div>
  );
}
