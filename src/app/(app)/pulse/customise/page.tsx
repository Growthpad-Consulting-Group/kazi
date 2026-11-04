import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { loadHomeModuleSelection } from "@/features/pulse/dashboard/home-module-data";
import HomeModulesForm from "@/features/pulse/dashboard/components/HomeModulesForm";

export default async function CustomisePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const selected = await loadHomeModuleSelection(session.user.id);

  return (
    <div className="space-y-6">
      <SetPageHeader
        title="Customise your home"
        description="Choose optional cards for your Pulse home."
        icon="solar:widget-2-broken"
      />
      <HomeModulesForm initial={selected} />
    </div>
  );
}
