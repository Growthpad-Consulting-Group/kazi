import { describe, expect, it } from "vitest";
import {
  SLACK_TIMER_CALLBACK_ID,
  buildSlackTimerModal,
  readSlackTimerSubmission,
} from "./slack-timer-view";

describe("Slack timer modal", () => {
  it("prefills a contextual activity and defaults to Meetings", () => {
    const modal = buildSlackTimerModal("Slack: #company-updates");
    expect(modal.callback_id).toBe(SLACK_TIMER_CALLBACK_ID);
    expect(JSON.stringify(modal)).toContain("Slack: #company-updates");
    expect(JSON.stringify(modal)).toContain('"value":"Meetings"');
  });

  it("reads a valid submission and rejects an unknown category", () => {
    expect(
      readSlackTimerSubmission({
        view: {
          state: {
            values: {
              task: { task: { value: "  Review client brief  " } },
              category: {
                category: { selected_option: { value: "Projects" } },
              },
            },
          },
        },
      }),
    ).toEqual({ task: "Review client brief", category: "Projects" });

    expect(
      readSlackTimerSubmission({
        view: {
          state: {
            values: {
              task: { task: { value: "Work" } },
              category: {
                category: { selected_option: { value: "Unknown" } },
              },
            },
          },
        },
      }),
    ).toEqual({ task: "Work", category: null });
  });
});
