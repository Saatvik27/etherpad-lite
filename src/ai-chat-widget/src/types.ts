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
  details: any;
}

export interface AIChatState {
  messages: Message[];
  isOpen: boolean;
  isThinking: boolean;
  pendingAction: PendingAction | null;
  isConnected: boolean;
}
