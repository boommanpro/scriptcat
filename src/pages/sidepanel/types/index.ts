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
