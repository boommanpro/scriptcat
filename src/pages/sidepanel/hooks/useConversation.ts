import { useState, useEffect } from "react";
import { loadConversation, saveConversation, createSession, switchSession } from "@App/pkg/ai";

export const useConversation = () => {
  const [currentDomain, setCurrentDomain] = useState("");
  const [domains, setDomains] = useState<string[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>("");
  const [hasCreatedSession, setHasCreatedSession] = useState<Record<string, boolean>>({});

  const loadConversationData = async (domain: string) => {
    try {
      const data = await loadConversation(domain);
      const activeSessions = data.sessions;
      setSessions(activeSessions);

      if (activeSessions.length === 0) {
        if (hasCreatedSession[domain]) {
          setCurrentSessionId("");
          return { sessions: [], messages: [] };
        }
        setHasCreatedSession((prev) => ({ ...prev, [domain]: true }));
        const newData = await createNewSession(domain);
        return newData;
      }

      const targetSessionId = data.currentSessionId || activeSessions[0].id;
      const targetSession = activeSessions.find((s) => s.id === targetSessionId);

      setCurrentSessionId(targetSessionId);
      return {
        sessions: activeSessions,
        messages: targetSession?.messages || [],
        currentSessionId: targetSessionId,
      };
    } catch (error) {
      console.error("Failed to load conversation:", error);
      return { sessions: [], messages: [] };
    }
  };

  const createNewSession = async (domain: string, title?: string) => {
    try {
      const data = await createSession(domain, title);
      setCurrentSessionId(data.currentSessionId!);
      setSessions(data.sessions);
      return { sessions: data.sessions, messages: [], currentSessionId: data.currentSessionId };
    } catch (error) {
      console.error("Failed to create session:", error);
      throw error;
    }
  };

  const switchToSession = async (domain: string, sessionId: string) => {
    try {
      const data = await switchSession(domain, sessionId);
      setCurrentSessionId(sessionId);
      const session = data.sessions.find((s) => s.id === sessionId);
      return session?.messages || [];
    } catch (error) {
      console.error("Failed to switch session:", error);
      throw error;
    }
  };

  const saveCurrentConversation = async (domain: string, msgs: any[]) => {
    try {
      const data = await loadConversation(domain);
      const updatedData = {
        ...data,
        sessions: data.sessions.map((session) => {
          if (session.id === currentSessionId) {
            return {
              ...session,
              messages: msgs,
              updatedAt: Date.now(),
            };
          }
          return session;
        }),
      };
      await saveConversation(domain, updatedData);
    } catch (error) {
      console.error("Failed to save conversation:", error);
    }
  };

  const getAllConversationDomains = async (): Promise<string[]> => {
    try {
      const allStorage = await chrome.storage.local.get(null);
      const domainSet = new Set<string>();
      for (const key of Object.keys(allStorage)) {
        if (key.startsWith("ai_conversations_")) {
          const domain = key.replace("ai_conversations_", "");
          domainSet.add(domain);
        }
      }
      return Array.from(domainSet).sort();
    } catch (error) {
      console.error("Failed to get all domains:", error);
      return [];
    }
  };

  const refreshDomains = async () => {
    const domainList = await getAllConversationDomains();
    setDomains(domainList);
  };

  return {
    currentDomain,
    setCurrentDomain,
    domains,
    setDomains,
    sessions,
    setSessions,
    currentSessionId,
    setCurrentSessionId,
    hasCreatedSession,
    setHasCreatedSession,
    loadConversationData,
    createNewSession,
    switchToSession,
    saveCurrentConversation,
    refreshDomains,
  };
};
