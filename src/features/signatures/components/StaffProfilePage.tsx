import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { getDepartments } from "@/features/departments/actions";
import StaffProfileClient from "./StaffProfileClient";

type Result = { data: unknown; error: { message: string } | null };
type Database = {
  from: (table: string) => {
    select: (fields: string) => {
      eq: (
        key: string,
        value: string,
      ) => { maybeSingle: () => PromiseLike<Result> };
    };
  };
};

export default async function StaffProfilePage({ id }: { id: string }) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_signatures"))
    redirect("/signatures/staff");
  const db = supabaseAdmin as unknown as Database;
  const [{ data, error }, departments] = await Promise.all([
    db
      .from("signature_staff_profiles")
      .select(
        "id,user_id,email,full_name,role_title,department,phone,mobile,photo_url,status",
      )
      .eq("id", id)
      .maybeSingle(),
    getDepartments().catch(() => [] as string[]),
  ]);
  if (error) throw new Error(error.message);
  if (!data) notFound();
  return (
    <StaffProfileClient profile={data as never} departments={departments} />
  );
}
