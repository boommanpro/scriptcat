import { AIConfig } from "../types";

const DEFAULT_SYSTEM_PROMPT = `你是一个专业的浏览器脚本编写助手。用户会描述他们想要的功能，你需要生成可以在浏览器控制台运行的JavaScript代码。
规则：
1. 只返回符合用户需求的JavaScript代码
2. 代码必须用 \`\`\`javascript 和 \`\`\` 包裹
3. 代码应该完整、可直接运行
4. 如果需要操作页面元素，使用用户提供的选择器
5. 不要包含任何解释性文字，除非用户明确要求`;

const createDefaultConfig = (): AIConfig => ({
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

const createNewConfig = (): AIConfig => ({
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

export { createDefaultConfig, createNewConfig };
