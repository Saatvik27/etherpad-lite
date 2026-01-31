'use strict';
/**
 * AIMessageHandler - Handle AI chat messages via Socket.IO
 */

import log4js from 'log4js';
import {ReActAgent} from './agents/ReActAgent';
import {AIContext} from './AIContext';
import {isEnabled} from './index';

const logger = log4js.getLogger('AIMessageHandler');

let agent: ReActAgent | null = null;

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
    logger.info(`Processing AI message from user ${userId} in pad ${padId}`);

    // Get conversation history
    const conversationHistory = await AIContext.getConversationContext(
      padId,
      userId,
      5
    );

    // Process with agent
    const result = await agent.process(
      userMessage,
      padId,
      userId,
      conversationHistory
    );

    // Save to history (unless it requires confirmation)
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
        }] : undefined
      );
    }

    // Send response back to user
    socket.emit('message', {
      type: 'AI_RESPONSE',
      data: {
        response: result.response,
        requiresConfirmation: result.requiresConfirmation,
        action: result.action,
        error: !!result.error,
      },
    });
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
  }
): Promise<void> => {
  const {padId, userId, authorId, confirmed, action, originalMessage} = message;

  if (!agent) {
    return;
  }

  try {
    if (!confirmed) {
      // User declined the action
      socket.emit('message', {
        type: 'AI_RESPONSE',
        data: {
          response: 'Action cancelled. How else can I help you?',
          error: false,
        },
      });
      return;
    }

    // Execute the confirmed action
    const result = await agent.executeAction(action, padId, authorId);

    // Save to history
    await AIContext.saveMessage(
      padId,
      userId,
      originalMessage,
      result.message,
      [{
        type: 'write',
        description: action.description || 'Modified pad content',
        confirmed: true,
        executed: result.success,
      }]
    );

    // Send result back
    socket.emit('message', {
      type: 'AI_RESPONSE',
      data: {
        response: result.message,
        error: !result.success,
      },
    });
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
 * Get AI chat history for a user
 */
export const handleGetAIHistory = async (
  socket: any,
  message: {
    padId: string;
    userId: string;
  }
): Promise<void> => {
  const {padId, userId} = message;

  try {
    const history = await AIContext.getHistory(padId, userId, 50);
    
    socket.emit('message', {
      type: 'AI_HISTORY',
      data: {
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
