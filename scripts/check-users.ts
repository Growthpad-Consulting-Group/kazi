import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  "https://vefioteqgbbhdznqttmw.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlZmlvdGVxZ2JiaGR6bnF0dG13Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjQwOTA3MSwiZXhwIjoyMTA3OTg1MDcxfQ.1Homi6_AfT7_psAf8inUInjRVAjJCNY4t-U-TJTk2cU",
);

const ids = [
  "96ef2fda-8209-49f8-84e5-2a646b077192",
  "b44c7fe5-6aed-4818-bb00-d0327f7da60a",
  "1eaddb60-118b-4143-80fd-d22a05522457",
];

async function main() {
  const { data, error } = await sb
    .from("users")
    .select("id, name, is_active, role")
    .in("id", ids);
  if (error) {
    console.error(error);
    process.exit(1);
  }
  console.table(data);
}

main();
