import { redirect } from "next/navigation";

export default function Page() {
  redirect("/hire/candidates?tab=pipeline");
}
