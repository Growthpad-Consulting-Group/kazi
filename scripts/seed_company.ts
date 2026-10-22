import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { error } = await (supabase as any).from("company_settings").update({
    company_name: "Growthpad Consulting Group",
    website: "https://growthpad.africa",
    country: "Kenya",
    industry: "Consulting & Professional Services",
    company_size: "11–50",
    timezone: "Africa/Nairobi",
    fiscal_year_start: 1,
    updated_at: new Date().toISOString(),
  }).eq("id", "default");

  if (error) { console.error("Error:", error.message); process.exit(1); }
  console.log("✓ Company settings seeded.");
}

main();
