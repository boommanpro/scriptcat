import type { AIConfig, ConversationData, DomainConversations } from "./types";

const DEFAULT_SYSTEM_PROMPT = `你是一个专业的浏览器脚本编写助手。用户会描述他们想要的功能，你需要生成可以在浏览器控制台运行的JavaScript代码。
规则：
1. 只返回符合用户需求的JavaScript代码
2. 代码必须用 \`\`\`javascript 和 \`\`\` 包裹
3. 代码应该完整、可直接运行
4. 如果需要操作页面元素，使用用户提供的选择器
5. 不要包含任何解释性文字，除非用户明确要求`;

export const createDefaultConfig = (): AIConfig => ({
  id: "default",
  name: "默认配置",
  isDefault: true,
  apiEndpoint: "http://localhost:1234/v1",
  apiKey: "",
  model: "qwen/qwen3-4b-2507",
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  temperature: 0.7,
  maxTokens: -1,
  enableKnowledgeBase: true,
});

export const createNewConfig = (): AIConfig => ({
  id: Date.now().toString(),
  name: "新配置",
  isDefault: false,
  apiEndpoint: "http://localhost:1234/v1",
  apiKey: "",
  model: "qwen/qwen3-4b-2507",
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  temperature: 0.7,
  maxTokens: -1,
  enableKnowledgeBase: true,
});

export const loadAISettings = async (): Promise<AIConfig[]> => {
  try {
    const result = await chrome.storage.local.get(["ai_configs", "ai_settings"]);

    if (result.ai_configs && Array.isArray(result.ai_configs)) {
      return result.ai_configs;
    } else if (result.ai_settings) {
      const oldSettings = result.ai_settings;
      const newConfig: AIConfig = {
        ...createDefaultConfig(),
        apiEndpoint: oldSettings.apiEndpoint || "http://localhost:1234/v1",
        apiKey: oldSettings.apiKey || "",
        model: oldSettings.model || "qwen/qwen3-4b-2507",
        systemPrompt: oldSettings.systemPrompt || DEFAULT_SYSTEM_PROMPT,
        temperature: oldSettings.temperature ?? 0.7,
        maxTokens: oldSettings.maxTokens ?? -1,
        enableKnowledgeBase: oldSettings.enableKnowledgeBase ?? true,
      };
      const configs = [newConfig];
      await chrome.storage.local.set({ ai_configs: configs });
      await chrome.storage.local.remove("ai_settings");
      return configs;
    }

    return [];
  } catch (error) {
    console.error("Failed to load AI settings:", error);
    return [];
  }
};

export const saveAiConfigs = async (configs: AIConfig[]): Promise<void> => {
  await chrome.storage.local.set({ ai_configs: configs });
};

export const addConfig = (configs: AIConfig[], newConfig: AIConfig): AIConfig[] => {
  return [...configs, newConfig];
};

export const updateConfig = (configs: AIConfig[], updatedConfig: AIConfig): AIConfig[] => {
  return configs.map((c) => (c.id === updatedConfig.id ? updatedConfig : c));
};

export const deleteConfig = (configs: AIConfig[], id: string): AIConfig[] => {
  return configs.filter((c) => c.id !== id);
};

export const setDefaultConfig = (configs: AIConfig[], id: string): AIConfig[] => {
  return configs.map((c) => ({
    ...c,
    isDefault: c.id === id,
  }));
};

export const copyConfig = (config: AIConfig): AIConfig => {
  return {
    ...config,
    id: Date.now().toString(),
    name: `${config.name} - 副本`,
    isDefault: false,
  };
};

export const testConnection = async (config: AIConfig): Promise<boolean> => {
  try {
    const response = await fetch(`${config.apiEndpoint}/models`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey && { Authorization: `Bearer ${config.apiKey}` }),
      },
    });
    return response.ok;
  } catch (error) {
    console.error("Connection test failed:", error);
    return false;
  }
};

export const loadAllConversations = async (): Promise<DomainConversations[]> => {
  try {
    const allStorage = await chrome.storage.local.get(null);
    const domainList: DomainConversations[] = [];

    for (const key of Object.keys(allStorage)) {
      if (key.startsWith("ai_conversations_")) {
        const domain = key.replace("ai_conversations_", "");
        const rawData = allStorage[key];

        if (!rawData || typeof rawData !== "object") {
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

export const loadConversation = async (domain: string): Promise<ConversationData> => {
  try {
    const result = await chrome.storage.local.get(`ai_conversations_${domain}`);
    const data: ConversationData = result[`ai_conversations_${domain}`] || { sessions: [] };
    return {
      ...data,
      sessions: data.sessions.filter((s) => !s.deleted),
    };
  } catch (error) {
    console.error("Failed to load conversation:", error);
    return { sessions: [] };
  }
};

export const saveConversation = async (domain: string, data: ConversationData): Promise<void> => {
  try {
    await chrome.storage.local.set({
      [`ai_conversations_${domain}`]: data,
    });
  } catch (error) {
    console.error("Failed to save conversation:", error);
    throw error;
  }
};

export const createSession = async (domain: string, title?: string): Promise<ConversationData> => {
  try {
    const result = await chrome.storage.local.get(`ai_conversations_${domain}`);
    const data: ConversationData = result[`ai_conversations_${domain}`] || { sessions: [] };

    const newSession = {
      id: Date.now().toString(),
      title: title || `对话 ${new Date().toLocaleString()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };

    const updatedSessions = [...data.sessions, newSession];
    const updatedData = {
      sessions: updatedSessions,
      currentSessionId: newSession.id,
    };

    await chrome.storage.local.set({
      [`ai_conversations_${domain}`]: updatedData,
    });

    return updatedData;
  } catch (error) {
    console.error("Failed to create session:", error);
    throw error;
  }
};

export const switchSession = async (domain: string, sessionId: string): Promise<ConversationData> => {
  try {
    const result = await chrome.storage.local.get(`ai_conversations_${domain}`);
    const data: ConversationData = result[`ai_conversations_${domain}`];

    if (!data) {
      throw new Error("No conversation data found");
    }

    const updatedData = {
      ...data,
      currentSessionId: sessionId,
    };

    await chrome.storage.local.set({
      [`ai_conversations_${domain}`]: updatedData,
    });

    return updatedData;
  } catch (error) {
    console.error("Failed to switch session:", error);
    throw error;
  }
};

export const loadSelectedConfigId = async (): Promise<string | null> => {
  try {
    const result = await chrome.storage.local.get("ai_selected_config_id");
    return result.ai_selected_config_id || null;
  } catch (error) {
    console.error("Failed to load selected config ID:", error);
    return null;
  }
};

export const saveSelectedConfigId = async (configId: string): Promise<void> => {
  try {
    await chrome.storage.local.set({ ai_selected_config_id: configId });
  } catch (error) {
    console.error("Failed to save selected config ID:", error);
  }
};
