import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { uploadToR2 } from "@/lib/r2";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/"))
    return NextResponse.json(
      { error: "Choose an image file." },
      { status: 400 },
    );
  if (file.size > MAX_BYTES)
    return NextResponse.json(
      { error: "An image must be 5 MB or smaller." },
      { status: 400 },
    );

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `pulse/voice-out/${randomUUID()}.${ext}`;
  try {
    const url = await uploadToR2(
      path,
      Buffer.from(await file.arrayBuffer()),
      file.type,
    );
    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 500 },
    );
  }
}
