'use strict';
/**
 * BaseAgent - Abstract base class for AI agents
 */

import {AIMessage as LangChainAIMessage} from '@langchain/core/messages';

export interface AgentResponse {
  response: string;
  requiresConfirmation: boolean;
  action?: {
    type: 'append' | 'replace' | 'insert' | 'delete';
    description: string;
    data: any;
  };
  error?: string;
}

export abstract class BaseAgent {
  /**
   * Process user query and return response
   */
  abstract process(
    userQuery: string,
    padId: string,
    userId: string,
    conversationHistory?: string
  ): Promise<AgentResponse>;

  /**
   * Execute confirmed action
   */
  abstract executeAction(
    action: any,
    padId: string,
    authorId: string
  ): Promise<{success: boolean; message: string}>;
}
