import { redirect } from "next/navigation";

// AI settings were merged into Integrations
export default function AIPage() {
  redirect("/settings/integrations");
}
