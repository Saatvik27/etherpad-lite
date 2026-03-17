export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'error';
  content: string;
  timestamp: number;
}

export interface PendingAction {
  actionId: string;
  type: string;
  description: string;
  action: any;
  sessionId?: string;
  padId: string;
  userId: string;
  authorId: string;
  originalMessage: string;
}

export interface ChatSession {
  sessionId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  lastMessagePreview: string;
  messageCount: number;
}

export interface AIChatState {
  messages: Message[];
  sessions: ChatSession[];
  activeSessionId: string | null;
  isOpen: boolean;
  isThinking: boolean;
  isLoadingHistory: boolean;
  pendingAction: PendingAction | null;
  isConnected: boolean;
}
