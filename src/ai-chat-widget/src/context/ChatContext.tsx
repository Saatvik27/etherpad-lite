import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { AIChatState, Message, PendingAction } from '../types';
import { socketService } from '../services/socket';

type Action =
  | { type: 'TOGGLE_CHAT' }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'SET_THINKING'; payload: boolean }
  | { type: 'SET_PENDING_ACTION'; payload: PendingAction | null }
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'LOAD_HISTORY'; payload: Message[] }
  | { type: 'CLEAR_MESSAGES' };

const initialState: AIChatState = {
  messages: [],
  isOpen: false,
  isThinking: false,
  pendingAction: null,
  isConnected: false,
};

function chatReducer(state: AIChatState, action: Action): AIChatState {
  switch (action.type) {
    case 'TOGGLE_CHAT':
      return { ...state, isOpen: !state.isOpen };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    case 'SET_THINKING':
      return { ...state, isThinking: action.payload };
    case 'SET_PENDING_ACTION':
      return { ...state, pendingAction: action.payload };
    case 'SET_CONNECTED':
      return { ...state, isConnected: action.payload };
    case 'LOAD_HISTORY':
      return { ...state, messages: action.payload };
    case 'CLEAR_MESSAGES':
      return { ...state, messages: [] };
    default:
      return state;
  }
}

interface ChatContextType {
  state: AIChatState;
  toggleChat: () => void;
  sendMessage: (content: string) => void;
  confirmAction: (actionId: string) => void;
  cancelAction: () => void;
  loadHistory: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  useEffect(() => {
    // Connect to socket
    socketService.connect().then(() => {
      dispatch({ type: 'SET_CONNECTED', payload: true });

      // Setup message handlers
      socketService.on('AI_RESPONSE', (data: any) => {
        console.log('[AI Chat Widget] AI_RESPONSE received:', data);
        dispatch({ type: 'SET_THINKING', payload: false });

        if (data.error) {
          dispatch({
            type: 'ADD_MESSAGE',
            payload: {
              id: Date.now().toString(),
              role: 'error',
              content: data.response || 'An error occurred',
              timestamp: Date.now(),
            },
          });
        } else if (data.requiresConfirmation) {
          dispatch({
            type: 'SET_PENDING_ACTION',
            payload: {
              actionId: data.actionId,
              type: data.action,
              description: data.response,
              details: data.actionDetails,
            },
          });
          dispatch({
            type: 'ADD_MESSAGE',
            payload: {
              id: Date.now().toString(),
              role: 'system',
              content: `${data.response}\n\nDo you want to proceed?`,
              timestamp: Date.now(),
            },
          });
        } else {
          dispatch({
            type: 'ADD_MESSAGE',
            payload: {
              id: Date.now().toString(),
              role: 'assistant',
              content: data.response,
              timestamp: Date.now(),
            },
          });
        }
      });

      socketService.on('AI_HISTORY', (data: any) => {
        if (data.history && Array.isArray(data.history)) {
          const messages: Message[] = data.history.map((msg: any, idx: number) => ({
            id: `${Date.now()}-${idx}`,
            role: msg.role,
            content: msg.content,
            timestamp: Date.now() - (data.history.length - idx) * 1000,
          }));
          dispatch({ type: 'LOAD_HISTORY', payload: messages });
        }
      });

      socketService.on('AI_PAD_MODIFIED', (data: any) => {
        dispatch({ type: 'SET_PENDING_ACTION', payload: null });
        dispatch({
          type: 'ADD_MESSAGE',
          payload: {
            id: Date.now().toString(),
            role: 'system',
            content: data.message || 'Pad has been modified successfully.',
            timestamp: Date.now(),
          },
        });
      });
    }).catch((error) => {
      console.error('Failed to connect socket:', error);
    });

    return () => {
      socketService.disconnect();
    };
  }, []);

  const toggleChat = () => {
    dispatch({ type: 'TOGGLE_CHAT' });
    if (!state.isOpen) {
      loadHistory();
    }
  };

  const sendMessage = (content: string) => {
    if (!content.trim()) return;

    dispatch({
      type: 'ADD_MESSAGE',
      payload: {
        id: Date.now().toString(),
        role: 'user',
        content,
        timestamp: Date.now(),
      },
    });

    dispatch({ type: 'SET_THINKING', payload: true });

    // Get pad info from parent window
    const parentWindow = window.parent || window;
    const pad = (parentWindow as any).pad;
    const padId = pad?.padId || 'unknown';
    const userId = pad?.myUserInfo?.userId || 'anonymous';
    
    console.log('[AI Chat Widget] Sending message:', { userMessage: content, padId, userId });
    
    socketService.send('AI_CHAT_MESSAGE', { 
      userMessage: content,
      padId,
      userId,
      authorId: userId
    });
  };

  const confirmAction = (actionId: string) => {
    socketService.send('AI_CONFIRM_ACTION', { actionId, confirmed: true });
    dispatch({ type: 'SET_PENDING_ACTION', payload: null });
  };

  const cancelAction = () => {
    if (state.pendingAction) {
      socketService.send('AI_CONFIRM_ACTION', {
        actionId: state.pendingAction.actionId,
        confirmed: false,
      });
      dispatch({ type: 'SET_PENDING_ACTION', payload: null });
      dispatch({
        type: 'ADD_MESSAGE',
        payload: {
          id: Date.now().toString(),
          role: 'system',
          content: 'Action cancelled.',
          timestamp: Date.now(),
        },
      });
    }
  };

  const loadHistory = () => {
    socketService.send('AI_GET_HISTORY', {});
  };

  return (
    <ChatContext.Provider
      value={{
        state,
        toggleChat,
        sendMessage,
        confirmAction,
        cancelAction,
        loadHistory,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return context;
}
