import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3/calendars";

// ── Config ─────────────────────────────────────────────────────────────────────

export function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google Calendar OAuth has not been configured (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI).");
  }
  return { clientId, clientSecret, redirectUri };
}

// ── Encryption (AES-256-GCM, v1:iv:tag:ciphertext) ────────────────────────────

function googleEncryptionKey() {
  const encoded = process.env.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY;
  if (!encoded) throw new Error("GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY is not configured.");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  return key;
}

export function encryptGoogleToken(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", googleEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptGoogleToken(value: string): string {
  const [version, iv, tag, ciphertext] = value.split(":");
  if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("Stored Google token is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", googleEncryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
}

// ── Token access + refresh ─────────────────────────────────────────────────────

export async function getGoogleAccessToken(userId: string): Promise<string> {
  const { data: row } = await supabaseAdmin
    .from("google_calendar_connections")
    .select("access_token_ciphertext, refresh_token_ciphertext, token_expiry")
    .eq("user_id", userId)
    .maybeSingle();

  if (!row) throw new Error("No Google Calendar connection found for this user.");

  // Refresh if token expires within 60 seconds
  const expiryMs = row.token_expiry ? new Date(row.token_expiry).getTime() : 0;
  if (Date.now() + 60_000 >= expiryMs) {
    const config = getGoogleConfig();
    const refreshToken = decryptGoogleToken(row.refresh_token_ciphertext);

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    const data = await res.json().catch(() => null) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
    } | null;
    if (!res.ok || !data?.access_token) throw new Error(data?.error ?? "Google token refresh failed.");

    const newExpiry = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString();
    await supabaseAdmin
      .from("google_calendar_connections")
      .update({
        access_token_ciphertext: encryptGoogleToken(data.access_token),
        token_expiry: newExpiry,
      })
      .eq("user_id", userId);

    return data.access_token;
  }

  return decryptGoogleToken(row.access_token_ciphertext);
}

// ── Calendar event helpers ─────────────────────────────────────────────────────

interface CalendarEventOpts {
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  attendeeEmails: string[];
}

async function getCalendarId(userId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("google_calendar_connections")
    .select("calendar_id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.calendar_id ?? "primary";
}

export async function createCalendarEvent(
  userId: string,
  opts: CalendarEventOpts
): Promise<{ eventId: string; htmlLink: string } | null> {
  try {
    const [accessToken, calendarId] = await Promise.all([
      getGoogleAccessToken(userId),
      getCalendarId(userId),
    ]);

    const body = {
      summary: opts.title,
      description: opts.description,
      start: { dateTime: opts.startAt },
      end: { dateTime: opts.endAt },
      attendees: opts.attendeeEmails.map((email) => ({ email })),
    };

    const res = await fetch(`${GOOGLE_CALENDAR_BASE}/${encodeURIComponent(calendarId)}/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => null) as { id?: string; htmlLink?: string; error?: unknown } | null;
    if (!res.ok || !data?.id) {
      console.error("Google Calendar createCalendarEvent failed", data?.error);
      return null;
    }

    return { eventId: data.id, htmlLink: data.htmlLink ?? "" };
  } catch (err) {
    // Non-throwing: log and return null when user has no connection
    console.error("createCalendarEvent error", err);
    return null;
  }
}

export async function updateCalendarEvent(
  userId: string,
  eventId: string,
  opts: { title?: string; description?: string; startAt?: string; endAt?: string }
): Promise<void> {
  try {
    const [accessToken, calendarId] = await Promise.all([
      getGoogleAccessToken(userId),
      getCalendarId(userId),
    ]);

    const body: Record<string, unknown> = {};
    if (opts.title) body.summary = opts.title;
    if (opts.description !== undefined) body.description = opts.description;
    if (opts.startAt) body.start = { dateTime: opts.startAt };
    if (opts.endAt) body.end = { dateTime: opts.endAt };

    const res = await fetch(
      `${GOOGLE_CALENDAR_BASE}/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      console.error("Google Calendar updateCalendarEvent failed", data);
    }
  } catch (err) {
    console.error("updateCalendarEvent error", err);
  }
}

export async function deleteCalendarEvent(userId: string, eventId: string): Promise<void> {
  try {
    const [accessToken, calendarId] = await Promise.all([
      getGoogleAccessToken(userId),
      getCalendarId(userId),
    ]);

    const res = await fetch(
      `${GOOGLE_CALENDAR_BASE}/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!res.ok && res.status !== 410) {
      // 410 Gone is fine — already deleted
      const data = await res.json().catch(() => null);
      console.error("Google Calendar deleteCalendarEvent failed", data);
    }
  } catch (err) {
    console.error("deleteCalendarEvent error", err);
  }
}
