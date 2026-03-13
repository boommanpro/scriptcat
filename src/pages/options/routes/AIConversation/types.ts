export interface ConversationSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: any[];
  deleted?: boolean;
}

export interface ConversationData {
  sessions: ConversationSession[];
  currentSessionId?: string;
}

export interface DomainConversations {
  domain: string;
  data: ConversationData;
}

export interface AIConfig {
  id: string;
  name: string;
  isDefault: boolean;
  apiEndpoint: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  enableKnowledgeBase: boolean;
}
