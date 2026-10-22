import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import SignatureCanvasEditor from "./SignatureCanvasEditor";

type Result = { data: unknown; error: { message: string } | null };
type Database = { from: (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => PromiseLike<Result> } } } };

export default async function SignatureTemplateEditorPage({ id }: { id: string }) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_signatures")) redirect("/signatures/templates");
  const database = supabaseAdmin as unknown as Database;
  const { data, error } = await database.from("signature_templates").select("id, name, description, html, blocks, canvas_width").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  return <SignatureCanvasEditor template={data as never} />;
}
