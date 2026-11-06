import { describe, expect, it } from "vitest";
import {
  RECOGNITION_CALLBACK_ID,
  buildRecognitionModal,
  readRecognitionSubmission,
} from "./slack-recognition-view";

describe("buildRecognitionModal", () => {
  it("offers only the options it was given, and marks campaign optional", () => {
    const modal = buildRecognitionModal({
      values: [{ id: "v1", name: "Ownership" }],
      campaigns: [{ id: "c1", name: "Client wins" }],
    });
    const serialised = JSON.stringify(modal);
    expect(modal.callback_id).toBe(RECOGNITION_CALLBACK_ID);
    expect(serialised).toContain("Ownership");
    expect(serialised).toContain("Client wins");
    const campaign = modal.blocks.find((b) => b.block_id === "campaign") as {
      optional?: boolean;
    };
    expect(campaign.optional).toBe(true);
  });

  it("leaves out value and campaign blocks when none are active", () => {
    const modal = buildRecognitionModal({ values: [], campaigns: [] });
    const ids = modal.blocks.map((b) => b.block_id);
    expect(ids).toEqual(["recipient", "message"]);
  });
});

describe("readRecognitionSubmission", () => {
  it("reads the submitted values and trims the message", () => {
    const result = readRecognitionSubmission({
      view: {
        state: {
          values: {
            recipient: { recipient: { selected_user: "U123" } },
            value: { value: { selected_option: { value: "v1" } } },
            message: { message: { value: "  Great work on the launch  " } },
          },
        },
      },
    });
    expect(result).toEqual({
      recipientSlackId: "U123",
      valueId: "v1",
      campaignId: null,
      message: "Great work on the launch",
    });
  });

  it("returns nulls when fields are missing", () => {
    expect(
      readRecognitionSubmission({ view: { state: { values: {} } } }),
    ).toEqual({
      recipientSlackId: null,
      valueId: null,
      campaignId: null,
      message: "",
    });
  });
});
