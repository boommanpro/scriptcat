export interface ConversationSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
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
  maxTokens: number;
  enableKnowledgeBase: boolean;
}

export interface SelectedElement {
  selector: string;
  tagName: string;
  textContent?: string;
  outerHTML?: string;
  href?: string;
  src?: string;
  id?: string;
  className?: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  codeBlocks?: CodeBlock[];
  request?: object;
  response?: object;
}

export interface CodeBlock {
  id: string;
  code: string;
  language: string;
  executed?: boolean;
  saved?: boolean;
}

export interface ConversationDataWithDomain {
  domain: string;
  sessions: ConversationSession[];
  currentSessionId?: string;
}
