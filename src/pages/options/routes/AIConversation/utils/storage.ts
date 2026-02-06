import { ConversationData, DomainConversations, AIConfig } from "../types";

export const loadAllConversations = async (): Promise<DomainConversations[]> => {
  console.log("[AIConversation] Loading all conversations...");
  try {
    const allStorage = await chrome.storage.local.get(null);
    console.log("[AIConversation] Storage keys:", Object.keys(allStorage));
    const domainList: DomainConversations[] = [];

    for (const key of Object.keys(allStorage)) {
      if (key.startsWith("ai_conversations_")) {
        const domain = key.replace("ai_conversations_", "");
        const rawData = allStorage[key];

        if (!rawData || typeof rawData !== "object") {
          console.warn(`Invalid data for domain ${domain}, skipping`);
          continue;
        }

        const data = rawData as ConversationData;
        const activeSessions = data.sessions?.filter((s) => !s.deleted) || [];

        if (activeSessions.length > 0) {
          domainList.push({
            domain,
            data: {
              ...data,
              sessions: activeSessions,
            },
          });
        }
      }
    }

    domainList.sort((a, b) => b.domain.localeCompare(a.domain));
    console.log("[AIConversation] Loaded domains:", domainList);
    return domainList;
  } catch (error) {
    console.error("Failed to load conversations:", error);
    throw error;
  }
};

export const deleteSession = async (domain: string, sessionId: string) => {
  const result = await chrome.storage.local.get(`ai_conversations_${domain}`);
  const data = result[`ai_conversations_${domain}`] as ConversationData;

  const updatedSessions = data.sessions.map((session) => {
    if (session.id === sessionId) {
      return { ...session, deleted: true };
    }
    return session;
  });

  await chrome.storage.local.set({
    [`ai_conversations_${domain}`]: {
      sessions: updatedSessions,
      currentSessionId: data.currentSessionId,
    },
  });
};

export const renameSession = async (domain: string, sessionId: string, newTitle: string) => {
  const result = await chrome.storage.local.get(`ai_conversations_${domain}`);
  const data = result[`ai_conversations_${domain}`] as ConversationData;

  const updatedSessions = data.sessions.map((session) => {
    if (session.id === sessionId) {
      return { ...session, title: newTitle.trim(), updatedAt: Date.now() };
    }
    return session;
  });

  await chrome.storage.local.set({
    [`ai_conversations_${domain}`]: {
      sessions: updatedSessions,
      currentSessionId: data.currentSessionId,
    },
  });
};

export const deleteDomainConversations = async (domain: string) => {
  await chrome.storage.local.remove(`ai_conversations_${domain}`);
};
