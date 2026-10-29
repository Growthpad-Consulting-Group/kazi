import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";

// ── Helpers ──────────────────────────────────────────────────────────────────

function isoWeekStart(offsetWeeks = 0): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1) - offsetWeeks * 7);
  return d.toISOString().slice(0, 10);
}

/** Convert an array of objects to CSV text. */
function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown): string => {
    const s = v === null || v === undefined ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ];
  return lines.join("\n");
}

// ── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "view_analytics")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "json";

  const now = new Date();
  const nowISO = now.toISOString();
  const ago30 = new Date(
    now.getTime() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const ago84 = new Date(
    now.getTime() - 84 * 24 * 60 * 60 * 1000,
  ).toISOString(); // 12 weeks

  // ── 1. Campaign summary ────────────────────────────────────────────────────
  const { data: campaignRows } = await supabaseAdmin
    .from("recognition_campaigns")
    .select("id, name, status, starts_at, ends_at, goal")
    .in("status", ["live", "completed", "upcoming"])
    .order("starts_at", { ascending: false })
    .limit(20);

  const campaigns = (campaignRows ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    starts_at: c.starts_at,
    ends_at: c.ends_at,
    goal: c.goal,
  }));

  // ── 2. Recognition summary ─────────────────────────────────────────────────
  const [recCountRes, topValuesRes, topGiversRes] = await Promise.all([
    supabaseAdmin
      .from("feedback")
      .select("id", { count: "exact", head: true })
      .eq("visibility", "public")
      .gte("created_at", ago30),

    // top values by usage
    supabaseAdmin
      .from("feedback")
      .select("value_id, recognition_values(name)")
      .eq("visibility", "public")
      .gte("created_at", ago30)
      .not("value_id", "is", null),

    // top givers
    supabaseAdmin
      .from("feedback")
      .select("from_user_id, users:users!from_user_id(name)")
      .eq("visibility", "public")
      .gte("created_at", ago30),
  ]);

  const recognitionTotal = recCountRes.count ?? 0;

  // Count by value
  type ValueRow = {
    value_id: string | null;
    recognition_values: { name: string } | null;
  };
  const valueCounts: Record<string, { name: string; count: number }> = {};
  for (const row of (topValuesRes.data ?? []) as unknown as ValueRow[]) {
    if (!row.value_id) continue;
    const name = row.recognition_values?.name ?? row.value_id;
    if (!valueCounts[row.value_id])
      valueCounts[row.value_id] = { name, count: 0 };
    valueCounts[row.value_id].count += 1;
  }
  const topValues = Object.values(valueCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((v) => ({ value: v.name, count: v.count }));

  // Count by giver
  type GiverRow = { from_user_id: string; users: { name: string } | null };
  const giverCounts: Record<string, { name: string; count: number }> = {};
  for (const row of (topGiversRes.data ?? []) as unknown as GiverRow[]) {
    const id = row.from_user_id;
    const name = row.users?.name ?? id;
    if (!giverCounts[id]) giverCounts[id] = { name, count: 0 };
    giverCounts[id].count += 1;
  }
  const topGivers = Object.values(giverCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((g) => ({ name: g.name, count: g.count }));

  const recognitionSummary = {
    total_last_30d: recognitionTotal,
    top_values: topValues,
    top_givers: topGivers,
  };

  // ── 3. Voice Out themes ────────────────────────────────────────────────────
  const { data: voiceRows } = await supabaseAdmin
    .from("voice_out_reports")
    .select("topic, status")
    .order("created_at", { ascending: false });

  type VoiceRow = { topic: string; status: string };
  const voiceThemes: Record<string, Record<string, number>> = {};
  for (const row of (voiceRows ?? []) as VoiceRow[]) {
    if (!voiceThemes[row.topic]) voiceThemes[row.topic] = {};
    voiceThemes[row.topic][row.status] =
      (voiceThemes[row.topic][row.status] ?? 0) + 1;
  }
  const voiceOutThemes = Object.entries(voiceThemes).map(
    ([topic, statuses]) => ({ topic, ...statuses }),
  );

  // ── 4. Survey participation ────────────────────────────────────────────────
  const [surveyRes, responseRes] = await Promise.all([
    supabaseAdmin
      .from("surveys")
      .select("id, title, status, opens_at, closes_at"),
    supabaseAdmin
      .from("survey_responses")
      .select("survey_id", { count: "exact" })
      .select("survey_id"),
  ]);

  type SurveyRow = {
    id: string;
    title: string;
    status: string;
    opens_at: string | null;
    closes_at: string | null;
  };
  const responseCounts: Record<string, number> = {};
  for (const r of (responseRes.data ?? []) as { survey_id: string }[]) {
    responseCounts[r.survey_id] = (responseCounts[r.survey_id] ?? 0) + 1;
  }

  const surveyParticipation = (surveyRes.data ?? []).map((s: SurveyRow) => ({
    title: s.title,
    status: s.status,
    opens_at: s.opens_at,
    closes_at: s.closes_at,
    response_count: responseCounts[s.id] ?? 0,
  }));

  // ── 5. Engagement trend (last 12 weeks) ───────────────────────────────────
  const { data: trendRows } = await supabaseAdmin
    .from("feedback")
    .select("created_at")
    .eq("visibility", "public")
    .gte("created_at", ago84)
    .order("created_at");

  // Group by ISO week start (Mon)
  const weekBuckets: Record<string, number> = {};
  for (const row of (trendRows ?? []) as { created_at: string }[]) {
    const d = new Date(row.created_at);
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    const key = d.toISOString().slice(0, 10);
    weekBuckets[key] = (weekBuckets[key] ?? 0) + 1;
  }

  // Build the 12 week labels in order
  const engagementTrend: { week: string; recognition_count: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const weekKey = isoWeekStart(i);
    engagementTrend.push({
      week: weekKey,
      recognition_count: weekBuckets[weekKey] ?? 0,
    });
  }

  // ── Assemble ───────────────────────────────────────────────────────────────
  const payload = {
    generated_at: nowISO,
    campaigns,
    recognition_summary: recognitionSummary,
    voice_out_themes: voiceOutThemes,
    survey_participation: surveyParticipation,
    engagement_trend: engagementTrend,
  };

  if (format === "csv") {
    // Flatten each section to its own CSV block separated by blank lines
    const sections = [
      `# Campaigns\n${toCsv(campaigns)}`,
      `# Recognition – top values\n${toCsv(topValues)}`,
      `# Recognition – top givers\n${toCsv(topGivers)}`,
      `# Voice Out themes\n${toCsv(voiceOutThemes)}`,
      `# Survey participation\n${toCsv(surveyParticipation)}`,
      `# Engagement trend\n${toCsv(engagementTrend)}`,
    ];
    const csv = sections.join("\n\n");
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="culture-report-${nowISO.slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json(payload);
}
