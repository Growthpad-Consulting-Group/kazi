import { supabaseAdmin } from "@/lib/supabase";

export type HireCompanyBrand = {
  displayName: string;
  applicationFromName: string | null;
  replyToEmail: string | null;
};

export async function getHireCompanyBrand(companyId: string): Promise<HireCompanyBrand> {
  const { data, error } = await supabaseAdmin
    .from("companies")
    .select("display_name, application_from_name, reply_to_email")
    .eq("id", companyId)
    .single();
  if (error || !data) throw new Error("Company not found");
  return {
    displayName: data.display_name,
    applicationFromName: data.application_from_name,
    replyToEmail: data.reply_to_email,
  };
}
