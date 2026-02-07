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

// 网络请求数据
export interface NetworkRequest {
  id: string;
  url: string;
  method: string;
  status?: number;
  statusText?: string;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  timestamp: number;
  selected?: boolean;
  type?: string;
  time?: number;
}

// 控制台日志数据
export interface ConsoleLog {
  id: string;
  level: "log" | "warn" | "error" | "info" | "debug" | "trace";
  message: string;
  args?: any[];
  stack?: string;
  timestamp: number;
  selected?: boolean;
  source?: string;
  line?: number;
  column?: number;
}

// 监听状态
export interface MonitorState {
  isRecording: boolean;
  networkEnabled: boolean;
  consoleEnabled: boolean;
}
