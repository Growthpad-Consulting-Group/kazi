import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { checkRateLimit, rateLimitHeaders, requestIp } from "@/lib/rate-limit";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

export async function GET(req: Request) {
  const companySlug = new URL(req.url).searchParams
    .get("company")
    ?.trim()
    .toLowerCase();
  if (!companySlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(companySlug))
    return NextResponse.json(
      { error: "A valid company is required" },
      { status: 400, headers: CACHE_HEADERS },
    );

  const limit = await checkRateLimit({
    scope: `public-jobs:${companySlug}`,
    identifier: requestIp(req.headers),
    limit: 120,
    windowSeconds: 60,
  });
  if (!limit.allowed)
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      {
        status: 429,
        headers: { ...CACHE_HEADERS, ...rateLimitHeaders(limit) },
      },
    );

  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("id, slug, display_name")
    .eq("slug", companySlug)
    .eq("is_active", true)
    .maybeSingle();
  if (!company)
    return NextResponse.json(
      { error: "Company not found" },
      { status: 404, headers: CACHE_HEADERS },
    );

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("jobs")
    .select(
      "slug, title, department, location, description, requirements, employment_type, work_mode, contract_duration, compensation, reports_to, public_details, published_at, closes_at",
    )
    .eq("company_id", company.id)
    .eq("status", "open")
    .or(`published_at.is.null,published_at.lte.${now}`)
    .or(`closes_at.is.null,closes_at.gt.${now}`)
    .order("published_at", { ascending: false, nullsFirst: false });

  if (error)
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: CACHE_HEADERS },
    );
  return NextResponse.json(
    { company: { slug: company.slug, name: company.display_name }, jobs: data },
    { headers: CACHE_HEADERS },
  );
}
