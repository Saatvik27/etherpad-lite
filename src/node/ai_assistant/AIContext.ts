'use strict';
/**
 * AIContext - Manages conversation context, sessions, and history for AI interactions
 */

import log4js from 'log4js';

const db = require('../db/DB');
const logger = log4js.getLogger('AIContext');

export interface AIMessage {
  messageId: string;
  sessionId: string;
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

export interface AIChatSession {
  sessionId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  lastMessagePreview: string;
  messageCount: number;
}

export class AIContext {
  private static readonly HISTORY_KEY_PREFIX = 'ai_chat_history:';
  private static readonly SESSIONS_KEY_PREFIX = 'ai_chat_sessions:';
  private static readonly MAX_HISTORY_PER_SESSION = 100;
  private static readonly DEFAULT_SESSION_TITLE = 'New chat';

  /**
   * Resolve a usable session ID for this user and pad.
   */
  static async resolveSessionId(
    padId: string,
    userId: string,
    requestedSessionId?: string
  ): Promise<string> {
    const sessions = await this.ensureSessionsInitialized(padId, userId);

    if (requestedSessionId && sessions.some((s) => s.sessionId === requestedSessionId)) {
      return requestedSessionId;
    }

    return sessions[0].sessionId;
  }

  /**
   * List sessions for the user in descending updatedAt order.
   */
  static async listSessions(padId: string, userId: string): Promise<AIChatSession[]> {
    const sessions = await this.ensureSessionsInitialized(padId, userId);
    return this.sortSessions(sessions);
  }

  /**
   * Create a new empty session.
   */
  static async createSession(
    padId: string,
    userId: string,
    title?: string
  ): Promise<AIChatSession> {
    const now = Date.now();
    const sessions = await this.ensureSessionsInitialized(padId, userId);

    const session: AIChatSession = {
      sessionId: this.generateSessionId(),
      title: (title || this.DEFAULT_SESSION_TITLE).trim() || this.DEFAULT_SESSION_TITLE,
      createdAt: now,
      updatedAt: now,
      lastMessagePreview: '',
      messageCount: 0,
    };

    const updated = this.sortSessions([session, ...sessions]);
    await db.set(this.getSessionsKey(padId, userId), updated);
    await db.set(this.getHistoryKey(padId, userId, session.sessionId), []);

    logger.info(`Created AI session ${session.sessionId} for user ${userId} in pad ${padId}`);
    return session;
  }

  /**
   * Save a message to a specific session (or resolve one automatically).
   */
  static async saveMessage(
    padId: string,
    userId: string,
    userMessage: string,
    aiResponse: string,
    aiActions?: AIAction[],
    sessionId?: string
  ): Promise<AIMessage> {
    const resolvedSessionId = await this.resolveSessionId(padId, userId, sessionId);
    const messageId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const message: AIMessage = {
      messageId,
      sessionId: resolvedSessionId,
      userId,
      userMessage,
      aiResponse,
      timestamp: Date.now(),
      aiActions,
    };

    const historyKey = this.getHistoryKey(padId, userId, resolvedSessionId);

    try {
      let history: AIMessage[] = await db.get(historyKey) || [];
      history.push(message);

      if (history.length > this.MAX_HISTORY_PER_SESSION) {
        history = history.slice(-this.MAX_HISTORY_PER_SESSION);
      }

      await db.set(historyKey, history);
      await this.touchSessionWithMessage(padId, userId, resolvedSessionId, userMessage, aiResponse, history.length);

      logger.info(`Saved AI message for user ${userId} in pad ${padId}, session ${resolvedSessionId}`);
      logger.debug('[AIContext] Session history saved', {
        padId,
        userId,
        sessionId: resolvedSessionId,
        messageId,
        totalMessages: history.length,
      });

      return message;
    } catch (error: any) {
      logger.error('Error saving AI message:', error);
      throw error;
    }
  }

  /**
   * Get chat history for a specific session.
   */
  static async getHistory(
    padId: string,
    userId: string,
    limit: number = 50,
    sessionId?: string
  ): Promise<AIMessage[]> {
    const resolvedSessionId = await this.resolveSessionId(padId, userId, sessionId);
    const historyKey = this.getHistoryKey(padId, userId, resolvedSessionId);

    try {
      const history: AIMessage[] = await db.get(historyKey) || [];
      logger.debug('[AIContext] Session history retrieved', {
        padId,
        userId,
        sessionId: resolvedSessionId,
        totalMessages: history.length,
        returnedMessages: Math.min(limit, history.length),
      });
      return history.slice(-limit);
    } catch (error: any) {
      logger.error('Error getting AI history:', error);
      return [];
    }
  }

  /**
   * Clear one session while keeping the session entry itself.
   */
  static async clearSession(
    padId: string,
    userId: string,
    sessionId?: string
  ): Promise<string> {
    const resolvedSessionId = await this.resolveSessionId(padId, userId, sessionId);
    const historyKey = this.getHistoryKey(padId, userId, resolvedSessionId);

    await db.set(historyKey, []);

    const sessions = await this.ensureSessionsInitialized(padId, userId);
    const now = Date.now();
    const updated = sessions.map((session) => {
      if (session.sessionId !== resolvedSessionId) return session;
      return {
        ...session,
        updatedAt: now,
        lastMessagePreview: '',
        messageCount: 0,
      };
    });

    await db.set(this.getSessionsKey(padId, userId), this.sortSessions(updated));

    logger.info(`Cleared AI session ${resolvedSessionId} for user ${userId} in pad ${padId}`);
    return resolvedSessionId;
  }

  /**
   * Get recent conversation context for prompting.
   */
  static async getConversationContext(
    padId: string,
    userId: string,
    messageCount: number = 5,
    sessionId?: string
  ): Promise<string> {
    const history = await this.getHistory(padId, userId, messageCount, sessionId);

    if (history.length === 0) {
      return '';
    }

    return history.map((msg) =>
      `User: ${msg.userMessage}\nAssistant: ${msg.aiResponse}`
    ).join('\n\n');
  }

  private static async ensureSessionsInitialized(
    padId: string,
    userId: string
  ): Promise<AIChatSession[]> {
    const sessionsKey = this.getSessionsKey(padId, userId);
    let sessions: AIChatSession[] = await db.get(sessionsKey) || [];

    if (Array.isArray(sessions) && sessions.length > 0) {
      return this.sortSessions(sessions.map((session) => this.normalizeSession(session)));
    }

    const legacyHistoryKey = this.getLegacyHistoryKey(padId, userId);
    const legacyHistory: AIMessage[] = await db.get(legacyHistoryKey) || [];

    if (legacyHistory.length > 0) {
      const migratedSessionId = this.generateSessionId();
      const createdAt = legacyHistory[0]?.timestamp || Date.now();
      const updatedAt = legacyHistory[legacyHistory.length - 1]?.timestamp || createdAt;
      const lastMessagePreview = this.preview(legacyHistory[legacyHistory.length - 1]?.aiResponse || '');
      const title = this.deriveTitle(legacyHistory[0]?.userMessage || this.DEFAULT_SESSION_TITLE);

      const migratedMessages: AIMessage[] = legacyHistory.map((msg) => ({
        ...msg,
        sessionId: migratedSessionId,
      }));

      const migratedSession: AIChatSession = {
        sessionId: migratedSessionId,
        title,
        createdAt,
        updatedAt,
        lastMessagePreview,
        messageCount: migratedMessages.length,
      };

      sessions = [migratedSession];
      await db.set(this.getHistoryKey(padId, userId, migratedSessionId), migratedMessages);
      await db.remove(legacyHistoryKey);

      logger.info(`Migrated legacy AI history for user ${userId} in pad ${padId} to session ${migratedSessionId}`);
    } else {
      const now = Date.now();
      sessions = [{
        sessionId: this.generateSessionId(),
        title: this.DEFAULT_SESSION_TITLE,
        createdAt: now,
        updatedAt: now,
        lastMessagePreview: '',
        messageCount: 0,
      }];

      await db.set(this.getHistoryKey(padId, userId, sessions[0].sessionId), []);
      logger.info(`Initialized default AI session for user ${userId} in pad ${padId}`);
    }

    const normalized = this.sortSessions(sessions);
    await db.set(sessionsKey, normalized);
    return normalized;
  }

  private static async touchSessionWithMessage(
    padId: string,
    userId: string,
    sessionId: string,
    userMessage: string,
    aiResponse: string,
    messageCount: number
  ): Promise<void> {
    const sessions = await this.ensureSessionsInitialized(padId, userId);
    const now = Date.now();

    const updated = sessions.map((session) => {
      if (session.sessionId !== sessionId) return session;

      const isDefaultTitle = !session.title || session.title === this.DEFAULT_SESSION_TITLE;
      return {
        ...session,
        title: isDefaultTitle ? this.deriveTitle(userMessage) : session.title,
        updatedAt: now,
        lastMessagePreview: this.preview(aiResponse),
        messageCount,
      };
    });

    await db.set(this.getSessionsKey(padId, userId), this.sortSessions(updated));
  }

  private static normalizeSession(session: Partial<AIChatSession>): AIChatSession {
    const now = Date.now();
    return {
      sessionId: session.sessionId || this.generateSessionId(),
      title: session.title || this.DEFAULT_SESSION_TITLE,
      createdAt: session.createdAt || now,
      updatedAt: session.updatedAt || session.createdAt || now,
      lastMessagePreview: session.lastMessagePreview || '',
      messageCount: typeof session.messageCount === 'number' ? session.messageCount : 0,
    };
  }

  private static sortSessions(sessions: AIChatSession[]): AIChatSession[] {
    return [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  private static deriveTitle(userMessage: string): string {
    const cleaned = (userMessage || '').replace(/\s+/g, ' ').trim();
    if (!cleaned) return this.DEFAULT_SESSION_TITLE;
    return cleaned.length > 48 ? `${cleaned.slice(0, 48)}...` : cleaned;
  }

  private static preview(text: string): string {
    const cleaned = (text || '').replace(/\s+/g, ' ').trim();
    if (!cleaned) return '';
    return cleaned.length > 120 ? `${cleaned.slice(0, 120)}...` : cleaned;
  }

  private static generateSessionId(): string {
    return `s_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private static getLegacyHistoryKey(padId: string, userId: string): string {
    return `${this.HISTORY_KEY_PREFIX}${padId}:${userId}`;
  }

  private static getHistoryKey(padId: string, userId: string, sessionId: string): string {
    return `${this.HISTORY_KEY_PREFIX}${padId}:${userId}:${sessionId}`;
  }

  private static getSessionsKey(padId: string, userId: string): string {
    return `${this.SESSIONS_KEY_PREFIX}${padId}:${userId}`;
  }
}
