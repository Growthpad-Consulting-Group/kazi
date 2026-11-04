import { supabaseAdmin } from "@/lib/supabase";
import { deliverSlackNotification } from "@/lib/slack";

function appUrl() {
  return process.env.PRODUCTION_APP_URL ?? "http://localhost:3000";
}

function surveyBlocks(text: string, path: string) {
  return [
    { type: "section", text: { type: "mrkdwn", text } },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: `<${appUrl()}${path}|Open in Kazi>` }],
    },
  ];
}

/** DMs each recipient once that a survey is live. Failures never reach the caller. */
export async function notifySurveyLaunchedOnSlack(
  surveyId: string,
  title: string,
  userIds: string[],
) {
  for (const userId of userIds) {
    try {
      await deliverSlackNotification({
        eventKey: `survey-published:${surveyId}:${userId}`,
        recipientUserId: userId,
        category: "survey_published",
        text: `New survey: ${title}`,
        blocks: surveyBlocks(
          `A new survey is open: *${title}*.`,
          "/pulse/surveys",
        ),
      });
    } catch (error) {
      console.error("[slack-alerts] survey launch DM failed", error);
    }
  }
}

/** DMs each recipient who has not responded that a survey closes soon. */
export async function notifySurveyClosingOnSlack(
  surveyId: string,
  title: string,
  userIds: string[],
) {
  for (const userId of userIds) {
    try {
      await deliverSlackNotification({
        eventKey: `survey-closing:${surveyId}:${userId}`,
        recipientUserId: userId,
        category: "survey_published",
        text: `Survey closing soon: ${title}`,
        blocks: surveyBlocks(
          `*${title}* closes soon. Your response is still outstanding.`,
          "/pulse/surveys",
        ),
      });
    } catch (error) {
      console.error("[slack-alerts] survey closing DM failed", error);
    }
  }
}

/**
 * Tells HR that a Voice Out report needs a response. The alert carries no
 * reporter, topic or message, so anonymity holds end to end.
 */
export async function notifyHrOfVoiceOutOnSlack(reportId: string) {
  try {
    const { data } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("role", "hr")
      .eq("is_active", true);
    const text = "A new Voice Out report needs a response in Kazi.";
    for (const hr of (data ?? []) as { id: string }[]) {
      await deliverSlackNotification({
        eventKey: `voice-out-new:${reportId}:${hr.id}`,
        recipientUserId: hr.id,
        category: "voice_out",
        text,
        blocks: surveyBlocks(text, "/pulse/voice-out"),
      });
    }
  } catch (error) {
    console.error("[slack-alerts] Voice Out HR alert failed", error);
  }
}
