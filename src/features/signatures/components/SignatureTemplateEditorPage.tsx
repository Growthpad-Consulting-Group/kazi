import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import SignatureCanvasEditor from "./SignatureCanvasEditor";

type Result = { data: unknown; error: { message: string } | null };
type Database = { from: (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => PromiseLike<Result> } } } };
type StaffResult = { data: unknown; error: { message: string } | null };
type StaffDatabase = { from: (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => { order: (column: string) => PromiseLike<StaffResult> } } } };

export default async function SignatureTemplateEditorPage({ id }: { id: string }) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_signatures")) redirect("/signatures/templates");
  const database = supabaseAdmin as unknown as Database;
  const staffDatabase = supabaseAdmin as unknown as StaffDatabase;
  const [{ data, error }, staffResult] = await Promise.all([
    database.from("signature_templates").select("id, name, description, html, blocks, canvas_width").eq("id", id).maybeSingle(),
    staffDatabase.from("signature_staff_profiles").select("id, full_name, email, role_title, department, phone, mobile, photo_url").eq("status", "active").order("full_name"),
  ]);
  if (error) throw new Error(error.message);
  if (staffResult.error) throw new Error(staffResult.error.message);
  if (!data) notFound();
  return <SignatureCanvasEditor template={data as never} staff={(staffResult.data ?? []) as never[]} />;
}
