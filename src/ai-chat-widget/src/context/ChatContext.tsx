import React, { createContext, useContext, useReducer, useEffect, ReactNode, useRef } from 'react';
import { AIChatState, ChatSession, Message, PendingAction } from '../types';
import { socketService } from '../services/socket';

type Action =
  | { type: 'TOGGLE_CHAT' }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'SET_THINKING'; payload: boolean }
  | { type: 'SET_PENDING_ACTION'; payload: PendingAction | null }
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'LOAD_HISTORY'; payload: Message[] }
  | { type: 'SET_SESSIONS'; payload: ChatSession[] }
  | { type: 'SET_ACTIVE_SESSION'; payload: string | null }
  | { type: 'SET_LOADING_HISTORY'; payload: boolean }
  | { type: 'CLEAR_MESSAGES' };

const initialState: AIChatState = {
  messages: [],
  sessions: [],
  activeSessionId: null,
  isOpen: false,
  isThinking: false,
  isLoadingHistory: false,
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
    case 'SET_SESSIONS':
      return { ...state, sessions: action.payload };
    case 'SET_ACTIVE_SESSION':
      return { ...state, activeSessionId: action.payload };
    case 'SET_LOADING_HISTORY':
      return { ...state, isLoadingHistory: action.payload };
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
  loadHistory: (sessionId?: string) => void;
  loadSessions: () => void;
  createNewSession: () => void;
  switchSession: (sessionId: string) => void;
  clearActiveSession: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

interface PadContextIdentity {
  padId: string;
  userId: string;
  authorId: string;
}

const getPadContextIdentity = (): PadContextIdentity => {
  const parentWindow = window.parent || window;
  const pad = (parentWindow as any).pad;

  let padId = pad?.padId || pad?.getPadId?.() || 'unknown';
  if (padId === 'unknown') {
    const match = parentWindow.location.pathname.match(/\/p\/([^\/]+)/);
    if (match) {
      padId = match[1];
      console.log('[AI Chat Widget] getPadContextIdentity: resolved padId from URL', padId);
    }
  }

  const userId = pad?.myUserInfo?.userId || pad?.userId || 'anonymous';
  const authorId = pad?.getUserId?.() || userId;

  return { padId, userId, authorId };
};

const hydrateHistory = (history: any[]): Message[] => {
  const now = Date.now();
  return history.flatMap((msg: any, idx: number) => {
    const baseTs = msg.timestamp || (now - (history.length - idx) * 1000);
    if (typeof msg.role === 'string' && typeof msg.content === 'string') {
      return [{
        id: `${baseTs}-${idx}-single`,
        role: msg.role,
        content: msg.content,
        timestamp: baseTs,
      } as Message];
    }

    const reconstructed: Message[] = [];
    if (msg.userMessage) {
      reconstructed.push({
        id: `${baseTs}-${idx}-user`,
        role: 'user',
        content: msg.userMessage,
        timestamp: baseTs,
      });
    }
    if (msg.aiResponse) {
      reconstructed.push({
        id: `${baseTs}-${idx}-assistant`,
        role: 'assistant',
        content: msg.aiResponse,
        timestamp: baseTs + 1,
      });
    }
    return reconstructed;
  });
};

export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const lastUserMessageRef = useRef<string>('');
  const activeSessionIdRef = useRef<string | null>(null);
  const pendingMessageRef = useRef<string | null>(null);
  const lastResponseSignatureRef = useRef<string>('');
  const lastResponseTimestampRef = useRef<number>(0);
  const thinkingTimeoutRef = useRef<number | null>(null);

  const loadSessions = () => {
    const { padId, userId } = getPadContextIdentity();
    console.log('[AI Chat Widget] Loading sessions', { padId, userId });
    socketService.send('AI_GET_SESSIONS', { padId, userId, activeSessionId: activeSessionIdRef.current });
  };

  const loadHistory = (sessionId?: string) => {
    const { padId, userId } = getPadContextIdentity();
    const resolvedSession = sessionId || activeSessionIdRef.current;
    console.log('[AI Chat Widget] Loading session history', { padId, userId, sessionId: resolvedSession });
    dispatch({ type: 'SET_LOADING_HISTORY', payload: true });
    socketService.send('AI_GET_HISTORY', { padId, userId, sessionId: resolvedSession });
  };

  const createNewSession = () => {
    const { padId, userId } = getPadContextIdentity();
    console.log('[AI Chat Widget] Creating new session', { padId, userId });
    dispatch({ type: 'SET_THINKING', payload: false });
    dispatch({ type: 'SET_LOADING_HISTORY', payload: true });
    socketService.send('AI_CREATE_SESSION', { padId, userId });
  };

  const switchSession = (sessionId: string) => {
    if (!sessionId) return;
    console.log('[AI Chat Widget] Switching session', { from: activeSessionIdRef.current, to: sessionId });
    dispatch({ type: 'SET_ACTIVE_SESSION', payload: sessionId });
    activeSessionIdRef.current = sessionId;
    loadHistory(sessionId);
  };

  const clearActiveSession = () => {
    const sessionId = activeSessionIdRef.current;
    if (!sessionId) return;

    const { padId, userId } = getPadContextIdentity();
    console.log('[AI Chat Widget] Clearing session', { padId, userId, sessionId });
    dispatch({ type: 'CLEAR_MESSAGES' });
    dispatch({ type: 'SET_THINKING', payload: false });
    dispatch({ type: 'SET_PENDING_ACTION', payload: null });
    socketService.send('AI_CLEAR_SESSION', { padId, userId, sessionId });
  };

  useEffect(() => {
    activeSessionIdRef.current = state.activeSessionId;
  }, [state.activeSessionId]);

  useEffect(() => {
    socketService.connect().then(() => {
      dispatch({ type: 'SET_CONNECTED', payload: true });

      socketService.onConnect(() => {
        dispatch({ type: 'SET_CONNECTED', payload: true });
      });

      socketService.onDisconnect(() => {
        console.log('[AI Chat Widget] Disconnected, updating status...');
        dispatch({ type: 'SET_CONNECTED', payload: false });
      });

      socketService.on('AI_RESPONSE', (data: any) => {
        console.log('[AI Chat Widget] AI_RESPONSE received:', data);
        dispatch({ type: 'SET_THINKING', payload: false });
        if (thinkingTimeoutRef.current) {
          window.clearTimeout(thinkingTimeoutRef.current);
          thinkingTimeoutRef.current = null;
        }

        const responseSignature = JSON.stringify({
          sessionId: data?.sessionId || null,
          response: data?.response || '',
          requiresConfirmation: !!data?.requiresConfirmation,
          hasAction: !!data?.action,
          error: !!data?.error,
        });
        const now = Date.now();
        const isDuplicate =
          responseSignature === lastResponseSignatureRef.current &&
          now - lastResponseTimestampRef.current < 4000;

        if (isDuplicate) {
          console.warn('[AI Chat Widget] Dropping duplicate AI_RESPONSE', {
            sessionId: data?.sessionId,
            preview: String(data?.response || '').slice(0, 120),
          });
          return;
        }
        lastResponseSignatureRef.current = responseSignature;
        lastResponseTimestampRef.current = now;

        if (data.sessionId && data.sessionId !== activeSessionIdRef.current) {
          dispatch({ type: 'SET_ACTIVE_SESSION', payload: data.sessionId });
          activeSessionIdRef.current = data.sessionId;
        }

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
          return;
        }

        if (data.requiresConfirmation) {
          const { padId, userId, authorId } = getPadContextIdentity();
          const originalMessage = lastUserMessageRef.current || '';

          dispatch({
            type: 'SET_PENDING_ACTION',
            payload: {
              actionId: Date.now().toString(),
              type: data.action?.type || 'unknown',
              description: data.response,
              action: data.action,
              sessionId: data.sessionId,
              padId,
              userId,
              authorId,
              originalMessage,
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
          return;
        }

        dispatch({
          type: 'ADD_MESSAGE',
          payload: {
            id: Date.now().toString(),
            role: 'assistant',
            content: data.response,
            timestamp: Date.now(),
          },
        });
      });

      socketService.on('AI_HISTORY', (data: any) => {
        console.log('[AI Chat Widget] AI_HISTORY received:', {
          sessionId: data?.sessionId,
          historyLength: data?.history?.length,
          hasError: data?.error,
        });

        dispatch({ type: 'SET_LOADING_HISTORY', payload: false });

        if (data?.sessionId && data.sessionId !== activeSessionIdRef.current) {
          dispatch({ type: 'SET_ACTIVE_SESSION', payload: data.sessionId });
          activeSessionIdRef.current = data.sessionId;
        }

        if (Array.isArray(data?.history)) {
          const messages = hydrateHistory(data.history);
          dispatch({ type: 'LOAD_HISTORY', payload: messages });
        }
      });

      socketService.on('AI_SESSIONS', (data: any) => {
        console.log('[AI Chat Widget] AI_SESSIONS received:', {
          sessionCount: data?.sessions?.length,
          activeSessionId: data?.activeSessionId,
          hasError: data?.error,
        });

        if (!Array.isArray(data?.sessions)) return;

        const sessions = data.sessions as ChatSession[];
        dispatch({ type: 'SET_SESSIONS', payload: sessions });

        const resolvedActive = data.activeSessionId || activeSessionIdRef.current || sessions[0]?.sessionId || null;
        if (resolvedActive && resolvedActive !== activeSessionIdRef.current) {
          dispatch({ type: 'SET_ACTIVE_SESSION', payload: resolvedActive });
          activeSessionIdRef.current = resolvedActive;
          loadHistory(resolvedActive);
        }
      });

      socketService.on('AI_SESSION_CREATED', (data: any) => {
        console.log('[AI Chat Widget] AI_SESSION_CREATED received:', data);
        dispatch({ type: 'SET_LOADING_HISTORY', payload: false });

        const createdSessionId = data?.session?.sessionId;
        if (createdSessionId) {
          dispatch({ type: 'SET_ACTIVE_SESSION', payload: createdSessionId });
          activeSessionIdRef.current = createdSessionId;
          dispatch({ type: 'CLEAR_MESSAGES' });

          if (pendingMessageRef.current) {
            const queuedMessage = pendingMessageRef.current;
            pendingMessageRef.current = null;
            setTimeout(() => {
              sendMessage(queuedMessage);
            }, 0);
          }
        }
      });

      socketService.on('AI_SESSION_CLEARED', (data: any) => {
        console.log('[AI Chat Widget] AI_SESSION_CLEARED received:', data);
        dispatch({ type: 'SET_LOADING_HISTORY', payload: false });
        dispatch({ type: 'LOAD_HISTORY', payload: [] });
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

      loadSessions();
    }).catch((error) => {
      console.error('Failed to connect socket:', error);
    });

    return () => {
      if (thinkingTimeoutRef.current) {
        window.clearTimeout(thinkingTimeoutRef.current);
        thinkingTimeoutRef.current = null;
      }
      socketService.disconnect();
    };
  }, []);

  const toggleChat = () => {
    dispatch({ type: 'TOGGLE_CHAT' });
    if (!state.isOpen) {
      loadSessions();
      loadHistory();
    }
  };

  const sendMessage = (content: string) => {
    if (!content.trim()) return;

    const activeSessionId = activeSessionIdRef.current;
    if (!activeSessionId) {
      pendingMessageRef.current = content;
      createNewSession();
      return;
    }

    dispatch({
      type: 'ADD_MESSAGE',
      payload: {
        id: Date.now().toString(),
        role: 'user',
        content,
        timestamp: Date.now(),
      },
    });

    lastUserMessageRef.current = content;
    dispatch({ type: 'SET_THINKING', payload: true });
    if (thinkingTimeoutRef.current) {
      window.clearTimeout(thinkingTimeoutRef.current);
    }
    thinkingTimeoutRef.current = window.setTimeout(() => {
      dispatch({ type: 'SET_THINKING', payload: false });
      console.warn('[AI Chat Widget] Thinking timeout reached, auto-resetting indicator');
    }, 45000);

    const { padId, userId, authorId } = getPadContextIdentity();

    console.log('[AI Chat Widget] Sending message:', { userMessage: content, padId, userId, authorId, sessionId: activeSessionId });

    socketService.send('AI_CHAT_MESSAGE', {
      userMessage: content,
      padId,
      userId,
      authorId,
      sessionId: activeSessionId,
    });
  };

  const confirmAction = (_actionId: string) => {
    if (state.pendingAction) {
      socketService.send('AI_CONFIRM_ACTION', {
        padId: state.pendingAction.padId,
        userId: state.pendingAction.userId,
        authorId: state.pendingAction.authorId,
        confirmed: true,
        action: state.pendingAction.action,
        originalMessage: state.pendingAction.originalMessage,
        sessionId: state.pendingAction.sessionId || activeSessionIdRef.current,
      });
      dispatch({ type: 'SET_PENDING_ACTION', payload: null });
    }
  };

  const cancelAction = () => {
    if (state.pendingAction) {
      socketService.send('AI_CONFIRM_ACTION', {
        padId: state.pendingAction.padId,
        userId: state.pendingAction.userId,
        authorId: state.pendingAction.authorId,
        confirmed: false,
        action: state.pendingAction.action,
        originalMessage: state.pendingAction.originalMessage,
        sessionId: state.pendingAction.sessionId || activeSessionIdRef.current,
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

  return (
    <ChatContext.Provider
      value={{
        state,
        toggleChat,
        sendMessage,
        confirmAction,
        cancelAction,
        loadHistory,
        loadSessions,
        createNewSession,
        switchSession,
        clearActiveSession,
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
