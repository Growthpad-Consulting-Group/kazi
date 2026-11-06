// Pure Block Kit builder and submission reader for the recognition modal. No database imports.
export const RECOGNITION_CALLBACK_ID = "recognise_teammate";
const MAX_MESSAGE_LENGTH = 1000;

type Option = { id: string; name: string };
export type RecognitionOptions = { values: Option[]; campaigns: Option[] };

function optionObjects(options: Option[]) {
  return options.map((option) => ({
    text: { type: "plain_text", text: option.name.slice(0, 75) },
    value: option.id,
  }));
}

/** Builds the "Recognise teammate" modal. Public recognition only; no image upload in this version. */
export function buildRecognitionModal(options: RecognitionOptions) {
  const blocks: Record<string, unknown>[] = [
    {
      type: "input",
      block_id: "recipient",
      label: { type: "plain_text", text: "Colleague" },
      element: {
        type: "users_select",
        action_id: "recipient",
        placeholder: { type: "plain_text", text: "Choose a colleague" },
      },
    },
  ];
  if (options.values.length)
    blocks.push({
      type: "input",
      block_id: "value",
      label: { type: "plain_text", text: "Company value" },
      element: {
        type: "static_select",
        action_id: "value",
        placeholder: { type: "plain_text", text: "Choose a value" },
        options: optionObjects(options.values),
      },
    });
  if (options.campaigns.length)
    blocks.push({
      type: "input",
      block_id: "campaign",
      optional: true,
      label: { type: "plain_text", text: "Campaign" },
      element: {
        type: "static_select",
        action_id: "campaign",
        placeholder: { type: "plain_text", text: "No campaign" },
        options: optionObjects(options.campaigns),
      },
    });
  blocks.push({
    type: "input",
    block_id: "message",
    label: { type: "plain_text", text: "Message" },
    hint: {
      type: "plain_text",
      text: "Shared as public recognition. Do not include private details.",
    },
    element: {
      type: "plain_text_input",
      action_id: "message",
      multiline: true,
      max_length: MAX_MESSAGE_LENGTH,
    },
  });

  return {
    type: "modal",
    callback_id: RECOGNITION_CALLBACK_ID,
    title: { type: "plain_text", text: "Recognise teammate" },
    submit: { type: "plain_text", text: "Send" },
    close: { type: "plain_text", text: "Cancel" },
    blocks,
  };
}

type ViewState = {
  view?: {
    state?: {
      values?: Record<
        string,
        Record<
          string,
          {
            selected_user?: string;
            selected_option?: { value: string } | null;
            value?: string | null;
          }
        >
      >;
    };
  };
};

export type RecognitionSubmission = {
  recipientSlackId: string | null;
  valueId: string | null;
  campaignId: string | null;
  message: string;
};

/** Reads the submitted modal values. Missing fields come back as null or an empty string. */
export function readRecognitionSubmission(
  payload: ViewState,
): RecognitionSubmission {
  const values = payload.view?.state?.values ?? {};
  return {
    recipientSlackId: values.recipient?.recipient?.selected_user ?? null,
    valueId: values.value?.value?.selected_option?.value ?? null,
    campaignId: values.campaign?.campaign?.selected_option?.value ?? null,
    message: (values.message?.message?.value ?? "").trim(),
  };
}
