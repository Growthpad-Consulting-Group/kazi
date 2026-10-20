import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { hasRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { DataRetentionClient } from "./DataRetentionClient";

type StaleCandidate = {
  id: string; full_name: string; email: string; stage: string; applied_at: string;
  jobs: { title: string } | null;
};

export default async function DataRetentionPage() {
  const session = await getServerSession(authOptions);
  if (!session || !hasRole(session.user.role, "hr")) redirect("/dashboard");

  // Candidates rejected or hired more than 12 months ago
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 12);

  const { data } = await supabaseAdmin
    .from("candidates")
    .select("id, full_name, email, stage, applied_at, jobs(title)")
    .in("stage", ["rejected", "hired"])
    .lt("applied_at", cutoff.toISOString())
    .order("applied_at", { ascending: true });

  const candidates = (data ?? []) as unknown as StaleCandidate[];

  return (
    <div className="space-y-6">
      <SetPageHeader
        title="Data Retention"
        description="ODPC compliance — candidates rejected or hired over 12 months ago"
        icon="solar:trash-bin-minimalistic-broken"
      />

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
        <strong>Policy reminder:</strong> Under Kenya's Data Protection Act, personal data must not be kept longer than necessary. Review and delete stale candidate records regularly. Deletion removes CV files from storage and all associated data.
      </div>

      <DataRetentionClient candidates={candidates} />
    </div>
  );
}
