'use strict';
/**
 * AIMessageHandler - Handle AI chat messages via Socket.IO
 */

import log4js from 'log4js';
import {ReActAgent} from './agents/ReActAgent';
import {AIContext} from './AIContext';
import {isEnabled} from './index';
import {PadContentReader} from './PadContentReader';

const logger = log4js.getLogger('AIMessageHandler');

let agent: ReActAgent | null = null;

const emitSessions = async (
  socket: any,
  padId: string,
  userId: string,
  activeSessionId?: string
): Promise<void> => {
  const sessions = await AIContext.listSessions(padId, userId);
  const resolvedActive = activeSessionId || sessions[0]?.sessionId || null;

  socket.emit('message', {
    type: 'AI_SESSIONS',
    data: {
      sessions,
      activeSessionId: resolvedActive,
    },
  });
};

/**
 * Initialize the AI agent
 */
export const initAgent = () => {
  if (!isEnabled()) {
    logger.warn('AI Assistant not enabled');
    return;
  }

  try {
    agent = new ReActAgent();
    logger.info('AI Agent initialized successfully');
  } catch (error: any) {
    logger.error('Failed to initialize AI agent:', error);
  }
};

/**
 * Handle incoming AI chat message from user
 */
export const handleAIChatMessage = async (
  socket: any,
  message: {
    padId: string;
    userId: string;
    authorId: string;
    userMessage: string;
    sessionId?: string;
  }
): Promise<void> => {
  const {padId, userId, authorId, userMessage} = message;

  if (!agent) {
    socket.emit('message', {
      type: 'AI_RESPONSE',
      data: {
        response: 'AI Assistant is not available at the moment.',
        error: true,
      },
    });
    return;
  }

  try {
    const sessionId = await AIContext.resolveSessionId(padId, userId, message.sessionId);

    logger.info(`Processing AI message from user ${userId} in pad ${padId}, session ${sessionId}`);
    logger.debug('[AIMessageHandler] Incoming message payload', {
      padId,
      userId,
      authorId,
      sessionId,
      messagePreview: (userMessage || '').slice(0, 120),
    });

    const conversationHistory = await AIContext.getConversationContext(
      padId,
      userId,
      12,
      sessionId
    );

    logger.debug('[AIMessageHandler] Loaded conversation context', {
      padId,
      userId,
      sessionId,
      contextLength: conversationHistory.length,
    });

    const result = await agent.process(
      userMessage,
      padId,
      userId,
      conversationHistory
    );

    if (!result.requiresConfirmation) {
      await AIContext.saveMessage(
        padId,
        userId,
        userMessage,
        result.response,
        result.action ? [{
          type: 'read',
          description: 'Read pad content',
          executed: true,
        }] : undefined,
        sessionId
      );
    }

    logger.debug('[AIMessageHandler] Sending AI_RESPONSE', {
      padId,
      userId,
      sessionId,
      requiresConfirmation: result.requiresConfirmation,
      hasAction: !!result.action,
      isError: !!result.error,
    });

    socket.emit('message', {
      type: 'AI_RESPONSE',
      data: {
        response: result.response,
        requiresConfirmation: result.requiresConfirmation,
        action: result.action,
        sessionId,
        error: !!result.error,
      },
    });

    await emitSessions(socket, padId, userId, sessionId);
  } catch (error: any) {
    logger.error('Error handling AI chat message:', error);
    socket.emit('message', {
      type: 'AI_RESPONSE',
      data: {
        response: 'Sorry, I encountered an error processing your request.',
        error: true,
      },
    });
  }
};

/**
 * Handle user confirmation of AI action
 */
export const handleAIConfirmation = async (
  socket: any,
  message: {
    padId: string;
    userId: string;
    authorId: string;
    confirmed: boolean;
    action: any;
    originalMessage: string;
    sessionId?: string;
  }
): Promise<void> => {
  const {padId, userId, authorId, confirmed, action, originalMessage} = message;

  if (!agent) return;

  try {
    const sessionId = await AIContext.resolveSessionId(padId, userId, message.sessionId);

    logger.info('[AIMessageHandler] Processing confirmation', {
      padId,
      userId,
      authorId,
      sessionId,
      confirmed,
      actionType: action?.type,
    });

    if (!confirmed) {
      socket.emit('message', {
        type: 'AI_RESPONSE',
        data: {
          response: 'Action cancelled. How else can I help you?',
          sessionId,
          error: false,
        },
      });
      return;
    }

    const result = await agent.executeAction(action, padId, authorId);

    let responseMessage = result.message;
    if (result.success) {
      const padText = await PadContentReader.getPadText(padId);
      const isComplete = !/\bTBD\b/i.test(padText);

      if (isComplete) {
        responseMessage = `${result.message}\n\nRequirement document complete. You can now review and finalize it for supplier issuance.`;
      } else {
        const conversationHistory = await AIContext.getConversationContext(
          padId,
          userId,
          12,
          sessionId
        );
        const followUp = await agent.generateNextQuestion(
          padId,
          originalMessage,
          conversationHistory
        );

        const normalizedFollowUp = (followUp || '').trim();
        const sentCompletionSignal =
          normalizedFollowUp.toUpperCase() === 'REQUIREMENTS_DOCUMENT_COMPLETE';

        // Guard against premature completion signals from the model.
        if (normalizedFollowUp && !sentCompletionSignal) {
          responseMessage = `${result.message}\n\n${normalizedFollowUp}`;
        } else {
          const fallbackQuestion =
            'Let\'s continue. Please confirm your required quantity, preferred chair type (standard/ergonomic/executive), target delivery date, and approximate budget range.';
          logger.warn('[AIMessageHandler] Missing or premature follow-up question, using fallback prompt', {
            padId,
            userId,
            sessionId,
            actionType: action?.type,
            followUp: normalizedFollowUp,
          });
          responseMessage = `${result.message}\n\n${fallbackQuestion}`;
        }
      }
    }

    await AIContext.saveMessage(
      padId,
      userId,
      originalMessage,
      responseMessage,
      [{
        type: 'write',
        description: action.description || 'Modified pad content',
        confirmed: true,
        executed: result.success,
      }],
      sessionId
    );

    socket.emit('message', {
      type: 'AI_RESPONSE',
      data: {
        response: responseMessage,
        sessionId,
        error: !result.success,
      },
    });

    await emitSessions(socket, padId, userId, sessionId);
  } catch (error: any) {
    logger.error('Error handling AI confirmation:', error);
    socket.emit('message', {
      type: 'AI_RESPONSE',
      data: {
        response: 'Error executing action.',
        error: true,
      },
    });
  }
};

/**
 * Get AI chat history for a user (specific session).
 */
export const handleGetAIHistory = async (
  socket: any,
  message: {
    padId: string;
    userId: string;
    sessionId?: string;
  }
): Promise<void> => {
  const {padId, userId} = message;

  try {
    if (!padId || !userId) {
      logger.warn('[AIMessageHandler] AI_GET_HISTORY missing identifiers', {padId, userId});
      socket.emit('message', {
        type: 'AI_HISTORY',
        data: {
          history: [],
          error: true,
          reason: 'Missing padId or userId',
        },
      });
      return;
    }

    const sessionId = await AIContext.resolveSessionId(padId, userId, message.sessionId);
    const history = await AIContext.getHistory(padId, userId, 100, sessionId);

    logger.info('[AIMessageHandler] Returning AI history', {
      padId,
      userId,
      sessionId,
      turns: history.length,
    });

    socket.emit('message', {
      type: 'AI_HISTORY',
      data: {
        sessionId,
        history,
      },
    });
  } catch (error: any) {
    logger.error('Error getting AI history:', error);
    socket.emit('message', {
      type: 'AI_HISTORY',
      data: {
        history: [],
        error: true,
      },
    });
  }
};

/**
 * Get list of AI chat sessions.
 */
export const handleGetAISessions = async (
  socket: any,
  message: {
    padId: string;
    userId: string;
    activeSessionId?: string;
  }
): Promise<void> => {
  const {padId, userId, activeSessionId} = message;

  try {
    if (!padId || !userId) {
      socket.emit('message', {
        type: 'AI_SESSIONS',
        data: {
          sessions: [],
          error: true,
          reason: 'Missing padId or userId',
        },
      });
      return;
    }

    await emitSessions(socket, padId, userId, activeSessionId);
  } catch (error: any) {
    logger.error('Error getting AI sessions:', error);
    socket.emit('message', {
      type: 'AI_SESSIONS',
      data: {
        sessions: [],
        error: true,
      },
    });
  }
};

/**
 * Create a new AI chat session.
 */
export const handleCreateAISession = async (
  socket: any,
  message: {
    padId: string;
    userId: string;
    title?: string;
  }
): Promise<void> => {
  const {padId, userId, title} = message;

  try {
    if (!padId || !userId) {
      socket.emit('message', {
        type: 'AI_SESSION_CREATED',
        data: {
          error: true,
          reason: 'Missing padId or userId',
        },
      });
      return;
    }

    const session = await AIContext.createSession(padId, userId, title);

    socket.emit('message', {
      type: 'AI_SESSION_CREATED',
      data: {
        session,
      },
    });

    await emitSessions(socket, padId, userId, session.sessionId);

    socket.emit('message', {
      type: 'AI_HISTORY',
      data: {
        sessionId: session.sessionId,
        history: [],
      },
    });
  } catch (error: any) {
    logger.error('Error creating AI session:', error);
    socket.emit('message', {
      type: 'AI_SESSION_CREATED',
      data: {
        error: true,
      },
    });
  }
};

/**
 * Clear an AI chat session.
 */
export const handleClearAISession = async (
  socket: any,
  message: {
    padId: string;
    userId: string;
    sessionId?: string;
  }
): Promise<void> => {
  const {padId, userId, sessionId} = message;

  try {
    if (!padId || !userId) {
      socket.emit('message', {
        type: 'AI_SESSION_CLEARED',
        data: {
          error: true,
          reason: 'Missing padId or userId',
        },
      });
      return;
    }

    const resolvedSessionId = await AIContext.clearSession(padId, userId, sessionId);

    socket.emit('message', {
      type: 'AI_SESSION_CLEARED',
      data: {
        sessionId: resolvedSessionId,
      },
    });

    await emitSessions(socket, padId, userId, resolvedSessionId);

    socket.emit('message', {
      type: 'AI_HISTORY',
      data: {
        sessionId: resolvedSessionId,
        history: [],
      },
    });
  } catch (error: any) {
    logger.error('Error clearing AI session:', error);
    socket.emit('message', {
      type: 'AI_SESSION_CLEARED',
      data: {
        error: true,
      },
    });
  }
};
