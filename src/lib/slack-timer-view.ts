import {
  DAILY_LOG_CATEGORIES,
  type DailyLogCategory,
} from "@/features/pulse/daily-log/constants";

export const SLACK_TIMER_CALLBACK_ID = "start_kazi_timer";
export const SLACK_MESSAGE_TIMER_CALLBACK_ID = "start_kazi_timer_from_message";

type TimerViewState = {
  view?: {
    state?: {
      values?: Record<
        string,
        Record<
          string,
          {
            value?: string | null;
            selected_option?: { value?: string | null } | null;
          }
        >
      >;
    };
  };
};

export type SlackTimerSubmission = {
  task: string;
  category: DailyLogCategory | null;
};

/** A short-lived Slack modal. It collects only the activity staff choose to log. */
export function buildSlackTimerModal(initialTask = "") {
  return {
    type: "modal",
    callback_id: SLACK_TIMER_CALLBACK_ID,
    title: { type: "plain_text", text: "Start Kazi timer" },
    submit: { type: "plain_text", text: "Start timer" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [
      {
        type: "input",
        block_id: "task",
        label: { type: "plain_text", text: "What are you working on?" },
        element: {
          type: "plain_text_input",
          action_id: "task",
          initial_value: initialTask.slice(0, 200),
          max_length: 200,
          placeholder: {
            type: "plain_text",
            text: "e.g. Prepare client proposal",
          },
        },
      },
      {
        type: "input",
        block_id: "category",
        label: { type: "plain_text", text: "Type" },
        element: {
          type: "static_select",
          action_id: "category",
          initial_option: {
            text: { type: "plain_text", text: "Meetings" },
            value: "Meetings",
          },
          options: DAILY_LOG_CATEGORIES.map((category) => ({
            text: { type: "plain_text", text: category },
            value: category,
          })),
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "The timer is shared with Kazi. Pause or stop it from the Kazi browser extension or daily log.",
          },
        ],
      },
    ],
  };
}

/** Reads only the activity and category explicitly entered in the Slack modal. */
export function readSlackTimerSubmission(
  payload: TimerViewState,
): SlackTimerSubmission {
  const values = payload.view?.state?.values ?? {};
  const task = (values.task?.task?.value ?? "").trim();
  const category = values.category?.category?.selected_option?.value ?? null;
  return {
    task,
    category: DAILY_LOG_CATEGORIES.includes(category as DailyLogCategory)
      ? (category as DailyLogCategory)
      : null,
  };
}
