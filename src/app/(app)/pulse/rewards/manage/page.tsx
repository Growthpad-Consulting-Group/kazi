import { redirect } from "next/navigation";

export default function Page() {
  redirect("/pulse/rewards?tab=manage");
}
