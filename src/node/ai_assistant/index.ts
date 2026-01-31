'use strict';
/**
 * AI Assistant Module - Main Entry Point
 * Provides AI-powered assistance for pad editing and content manipulation
 */

import log4js from 'log4js';
import settings from '../utils/Settings';

const logger = log4js.getLogger('AIAssistant');

export interface AIAssistantConfig {
  enabled: boolean;
  provider: 'groq' | 'openai' | 'local';
  apiKey: string | null;
  model: string;
  maxTokens: number;
  temperature: number;
  features: {
    canReadPad: boolean;
    canWritePad: boolean;
    canSummarize: boolean;
    maxRequestsPerMinute: number;
  };
}

/**
 * Initialize AI Assistant module
 */
export const init = () => {
  if (!settings.aiAssistant?.enabled) {
    logger.info('AI Assistant is disabled');
    return;
  }

  logger.info(`AI Assistant initialized with provider: ${settings.aiAssistant.provider}`);
  logger.info(`Model: ${settings.aiAssistant.model}`);
};

/**
 * Check if AI Assistant is enabled and properly configured
 */
export const isEnabled = (): boolean => {
  return settings.aiAssistant?.enabled === true && 
         settings.aiAssistant?.apiKey != null;
};

/**
 * Get AI Assistant configuration
 */
export const getConfig = (): AIAssistantConfig => {
  return settings.aiAssistant;
};
