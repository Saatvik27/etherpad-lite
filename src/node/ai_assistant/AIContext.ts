'use strict';
/**
 * AIContext - Manages conversation context and history for AI interactions
 */

import log4js from 'log4js';

const db = require('../db/DB');
const logger = log4js.getLogger('AIContext');

export interface AIMessage {
  messageId: string;
  userId: string;
  userMessage: string;
  aiResponse: string;
  timestamp: number;
  padContentSnapshot?: string;
  aiActions?: AIAction[];
}

export interface AIAction {
  type: 'read' | 'write' | 'search' | 'summarize';
  description: string;
  confirmed?: boolean;
  executed?: boolean;
}

export class AIContext {
  private static readonly HISTORY_KEY_PREFIX = 'ai_chat_history:';
  private static readonly MAX_HISTORY_PER_USER = 100;

  /**
   * Save a message to user's AI chat history
   */
  static async saveMessage(
    padId: string,
    userId: string,
    userMessage: string,
    aiResponse: string,
    aiActions?: AIAction[]
  ): Promise<AIMessage> {
    const messageId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const message: AIMessage = {
      messageId,
      userId,
      userMessage,
      aiResponse,
      timestamp: Date.now(),
      aiActions,
    };

    const historyKey = this.getHistoryKey(padId, userId);
    
    try {
      let history: AIMessage[] = await db.get(historyKey) || [];
      history.push(message);
      
      // Keep only last MAX_HISTORY_PER_USER messages
      if (history.length > this.MAX_HISTORY_PER_USER) {
        history = history.slice(-this.MAX_HISTORY_PER_USER);
      }
      
      await db.set(historyKey, history);
      logger.info(`Saved AI message for user ${userId} in pad ${padId}`);
      
      return message;
    } catch (error: any) {
      logger.error(`Error saving AI message:`, error);
      throw error;
    }
  }

  /**
   * Get user's AI chat history for a specific pad
   */
  static async getHistory(
    padId: string,
    userId: string,
    limit: number = 50
  ): Promise<AIMessage[]> {
    const historyKey = this.getHistoryKey(padId, userId);
    
    try {
      const history: AIMessage[] = await db.get(historyKey) || [];
      return history.slice(-limit);
    } catch (error: any) {
      logger.error(`Error getting AI history:`, error);
      return [];
    }
  }

  /**
   * Clear user's AI chat history for a pad
   */
  static async clearHistory(padId: string, userId: string): Promise<void> {
    const historyKey = this.getHistoryKey(padId, userId);
    
    try {
      await db.remove(historyKey);
      logger.info(`Cleared AI history for user ${userId} in pad ${padId}`);
    } catch (error: any) {
      logger.error(`Error clearing AI history:`, error);
      throw error;
    }
  }

  /**
   * Get conversation context for the AI (last N messages)
   */
  static async getConversationContext(
    padId: string,
    userId: string,
    messageCount: number = 5
  ): Promise<string> {
    const history = await this.getHistory(padId, userId, messageCount);
    
    if (history.length === 0) {
      return '';
    }

    return history.map(msg => 
      `User: ${msg.userMessage}\nAssistant: ${msg.aiResponse}`
    ).join('\n\n');
  }

  /**
   * Generate history key for storage
   */
  private static getHistoryKey(padId: string, userId: string): string {
    return `${this.HISTORY_KEY_PREFIX}${padId}:${userId}`;
  }
}
