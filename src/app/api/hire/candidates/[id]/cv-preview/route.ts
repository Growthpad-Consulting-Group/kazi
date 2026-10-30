import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mammoth from "mammoth";
import sanitizeHtml from "sanitize-html";
import { authOptions } from "@/lib/auth";
import { canView } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";

function documentHtml(body: string) {
  return `<!doctype html><html><head><meta charset="utf-8" /><style>
    * { box-sizing: border-box; } body { margin: 0; padding: 2.5rem; color: #1f2937; background: #fff; font-family: Inter, ui-sans-serif, system-ui, sans-serif; font-size: 14px; line-height: 1.65; }
    h1, h2, h3, h4 { color: #111827; line-height: 1.25; margin: 1.75rem 0 .65rem; } h1 { font-size: 1.6rem; } h2 { font-size: 1.25rem; } h3 { font-size: 1.05rem; }
    p { margin: 0 0 .75rem; } ul, ol { padding-left: 1.4rem; margin: 0 0 1rem; } li { margin-bottom: .3rem; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; } td, th { border: 1px solid #e5e7eb; padding: .55rem; text-align: left; } img { max-width: 100%; height: auto; }
  </style></head><body>${body}</body></html>`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  // Match the Hire layout: normal hiring roles and the explicit read-only
  // "View all admin screens" grant may review CVs, but may not modify them.
  if (!session || !canView(session.user, "view_hiring"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { data: candidate } = await supabaseAdmin
    .from("candidates")
    .select("cv_url")
    .eq("id", id)
    .maybeSingle();
  if (!candidate?.cv_url)
    return NextResponse.json({ error: "CV not found" }, { status: 404 });

  let source: URL;
  try {
    source = new URL(candidate.cv_url);
  } catch {
    return NextResponse.json({ error: "Invalid CV source" }, { status: 400 });
  }
  if (!source.hostname.endsWith(".r2.dev"))
    return NextResponse.json({ error: "Unsupported CV source" }, { status: 400 });

  const response = await fetch(source, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok)
    return NextResponse.json({ error: "Could not load CV" }, { status: 502 });

  const extension = source.pathname.split(".").pop()?.toLowerCase();
  if (extension === "pdf") {
    return new NextResponse(response.body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=\"candidate-cv.pdf\"",
        "Cache-Control": "private, no-store",
      },
    });
  }
  if (extension !== "docx")
    return NextResponse.json({ error: "Unsupported CV format" }, { status: 415 });

  try {
    const result = await mammoth.convertToHtml({
      buffer: Buffer.from(await response.arrayBuffer()),
    });
    const safe = sanitizeHtml(result.value, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
      allowedAttributes: { "*": ["href"], img: ["src", "alt"] },
      allowedSchemes: ["http", "https", "data"],
    });
    return new NextResponse(documentHtml(safe), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": "inline; filename=\"candidate-cv-preview.html\"",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data: https:; frame-ancestors 'self'",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not preview this Word document" }, { status: 422 });
  }
}
