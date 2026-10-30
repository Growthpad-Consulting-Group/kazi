import { google } from "googleapis";
import { publicJobUrl } from "@/lib/careers-url";

const INDEXING_SCOPE = "https://www.googleapis.com/auth/indexing";

export type GoogleIndexingNotification = "URL_UPDATED" | "URL_DELETED";

/**
 * Tells Google that a public careers URL changed or was removed. Missing or
 * invalid credentials never block hiring operations; the scheduler retries it.
 */
export async function notifyGoogleOfJob(
  slug: string,
  type: GoogleIndexingNotification,
): Promise<boolean> {
  const rawCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!rawCredentials) return false;

  try {
    const credentials = JSON.parse(rawCredentials) as Record<string, unknown>;
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [INDEXING_SCOPE],
    });
    const indexing = google.indexing({ version: "v3", auth });
    await indexing.urlNotifications.publish({
      requestBody: { url: publicJobUrl(slug), type },
    });
    return true;
  } catch (error) {
    console.error(
      "Google job indexing notification failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return false;
  }
}
