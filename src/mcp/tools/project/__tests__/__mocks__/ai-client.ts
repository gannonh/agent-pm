/**
 * @fileoverview Mock implementation of the AI client interface for testing
 */

import {
  AIClient,
  AIMessage,
  AIResponse,
  AIStreamCallbacks,
} from '../../../../../core/ai-client.js';
import { logger } from '../../../../utils/logger.js';

/**
 * Create a mock AI client for testing
 * @returns Mock AI client
 */
export function createMockAiClient(): AIClient {
  return {
    async chat(
      messages: AIMessage[],
      options?: {
        temperature?: number;
        maxTokens?: number;
        systemPrompt?: string;
        bypassCache?: boolean;
      }
    ): Promise<AIResponse> {
      logger.debug('Mock AI client chat called', { messages, options });
      return {
        content: [{ type: 'text', text: 'This is a mock response from AI client' }],
      };
    },

    async streamChat(
      messages: AIMessage[],
      options?: {
        temperature?: number;
        maxTokens?: number;
        systemPrompt?: string;
      },
      callbacks?: AIStreamCallbacks
    ): Promise<AIResponse> {
      logger.debug('Mock AI client streamChat called', { messages, options });

      // Simulate streaming by calling the callbacks
      if (callbacks?.onContent) {
        callbacks.onContent('This is a mock streaming response');
      }

      if (callbacks?.onComplete) {
        callbacks.onComplete({
          content: [{ type: 'text', text: 'This is a mock response from AI client' }],
        });
      }

      return {
        content: [{ type: 'text', text: 'This is a mock response from AI client' }],
      };
    },
  };
}

/**
 * Mock implementation of createAiClient for testing
 * @returns Mock AI client
 */
export function createAiClient(): AIClient {
  return createMockAiClient();
}
