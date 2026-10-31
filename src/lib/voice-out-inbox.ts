export type SavedVoiceOutConversation = {
  code: string;
  savedAt: string;
  seenHrReplies: number;
};

const INBOX_KEY = "kazi_voice_out_private_conversations";
const ACTIVE_CODE_KEY = "kazi_voice_out_active_code";

export function getSavedVoiceOutConversations(): SavedVoiceOutConversation[] {
  try {
    const value = window.localStorage.getItem(INBOX_KEY);
    const parsed = value ? (JSON.parse(value) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is SavedVoiceOutConversation =>
            !!item &&
            typeof item.code === "string" &&
            typeof item.savedAt === "string" &&
            typeof item.seenHrReplies === "number",
        )
      : [];
  } catch {
    return [];
  }
}

function save(conversations: SavedVoiceOutConversation[]) {
  window.localStorage.setItem(INBOX_KEY, JSON.stringify(conversations));
}

export function saveVoiceOutConversation(code: string) {
  const conversations = getSavedVoiceOutConversations();
  if (!conversations.some((conversation) => conversation.code === code)) {
    conversations.unshift({
      code,
      savedAt: new Date().toISOString(),
      seenHrReplies: 0,
    });
    save(conversations.slice(0, 10));
  }
}

export function setActiveVoiceOutConversation(code: string) {
  window.sessionStorage.setItem(ACTIVE_CODE_KEY, code);
}

export function getActiveVoiceOutConversation() {
  return window.sessionStorage.getItem(ACTIVE_CODE_KEY) ?? "";
}

export function markVoiceOutRepliesSeen(code: string, seenHrReplies: number) {
  save(
    getSavedVoiceOutConversations().map((conversation) =>
      conversation.code === code
        ? { ...conversation, seenHrReplies }
        : conversation,
    ),
  );
}
