/**
 * @fileoverview AI client interface for interacting with AI services
 */

/**
 * AI message content type
 */
export type AIContentType = 'text' | 'image' | 'code' | 'error';

/**
 * AI message content
 */
export interface AIContent {
  type: AIContentType;
  text: string;
  language?: string;
  metadata?: Record<string, unknown>;
}

/**
 * AI message
 */
export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  name?: string;
}

/**
 * AI response
 */
export interface AIResponse {
  content: AIContent[];
  metadata?: Record<string, unknown>;
}

/**
 * AI stream callbacks
 */
export interface AIStreamCallbacks {
  onContent?: (content: string) => void;
  onComplete?: (response: AIResponse) => void;
  onError?: (error: Error) => void;
}

/**
 * AI client interface
 */
export interface AIClient {
  /**
   * Send a chat message to the AI service
   * @param messages - The messages to send
   * @param options - Options for the chat
   * @returns The AI response
   */
  chat(
    messages: AIMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
      bypassCache?: boolean;
    }
  ): Promise<AIResponse>;

  /**
   * Stream a chat message to the AI service
   * @param messages - The messages to send
   * @param options - Options for the chat
   * @param callbacks - Callbacks for streaming
   * @returns The AI response
   */
  streamChat(
    messages: AIMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    },
    callbacks?: AIStreamCallbacks
  ): Promise<AIResponse>;
}

/**
 * Create an AI client
 * @returns The AI client
 */
export function createAiClient(): AIClient {
  throw new Error('Not implemented');
}
