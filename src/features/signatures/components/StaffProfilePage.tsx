import Link from "next/link";
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
  const profile = data as { id: string; user_id: string | null };
  const canCreateStaff = can(session.user.role, "manage_people");
  return (
    <>
      {!profile.user_id && canCreateStaff && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
          <p className="text-[var(--text-lo)]">
            This signature profile has no staff account in Kazi.
          </p>
          <Link
            href={`/staff?fromSignatureProfile=${profile.id}`}
            className="font-semibold text-brand-600 hover:underline"
          >
            Create staff account
          </Link>
        </div>
      )}
      <StaffProfileClient profile={data as never} departments={departments} />
    </>
  );
}
