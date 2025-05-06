/**
 * @fileoverview Tests for the AI client interface
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIClient, AIMessage, AIStreamCallbacks, createAiClient } from '../ai-client.js';

// Create a mock implementation of the AIClient interface
const createMockAiClient = (): AIClient => ({
  chat: vi.fn().mockResolvedValue({
    content: [{ type: 'text', text: 'Mock response' }],
  }),
  streamChat: vi.fn().mockImplementation(async (messages, options, callbacks) => {
    if (callbacks?.onContent) {
      callbacks.onContent('Streaming content');
    }
    if (callbacks?.onComplete) {
      callbacks.onComplete({
        content: [{ type: 'text', text: 'Complete response' }],
      });
    }
    return {
      content: [{ type: 'text', text: 'Mock streaming response' }],
    };
  }),
});

describe('AI Client Interface', () => {
  describe('AIClient Interface', () => {
    let mockClient: AIClient;

    beforeEach(() => {
      mockClient = createMockAiClient();
    });

    it('should define the required methods', () => {
      expect(mockClient.chat).toBeDefined();
      expect(mockClient.streamChat).toBeDefined();
      expect(typeof mockClient.chat).toBe('function');
      expect(typeof mockClient.streamChat).toBe('function');
    });

    it('should handle chat messages', async () => {
      const messages: AIMessage[] = [{ role: 'user', content: 'Hello' }];

      const response = await mockClient.chat(messages);

      expect(mockClient.chat).toHaveBeenCalledWith(messages);
      expect(response).toEqual({
        content: [{ type: 'text', text: 'Mock response' }],
      });
    });

    it('should handle chat messages with options', async () => {
      const messages: AIMessage[] = [{ role: 'user', content: 'Hello' }];

      const options = {
        temperature: 0.5,
        maxTokens: 1000,
        systemPrompt: 'You are a helpful assistant',
      };

      const response = await mockClient.chat(messages, options);

      expect(mockClient.chat).toHaveBeenCalledWith(messages, options);
      expect(response).toEqual({
        content: [{ type: 'text', text: 'Mock response' }],
      });
    });

    it('should handle streaming chat messages', async () => {
      const messages: AIMessage[] = [{ role: 'user', content: 'Hello' }];

      const callbacks: AIStreamCallbacks = {
        onContent: vi.fn(),
        onComplete: vi.fn(),
      };

      const response = await mockClient.streamChat(messages, undefined, callbacks);

      expect(mockClient.streamChat).toHaveBeenCalledWith(messages, undefined, callbacks);
      expect(callbacks.onContent).toHaveBeenCalledWith('Streaming content');
      expect(callbacks.onComplete).toHaveBeenCalledWith({
        content: [{ type: 'text', text: 'Complete response' }],
      });
      expect(response).toEqual({
        content: [{ type: 'text', text: 'Mock streaming response' }],
      });
    });

    it('should handle streaming chat messages with options', async () => {
      const messages: AIMessage[] = [{ role: 'user', content: 'Hello' }];

      const options = {
        temperature: 0.5,
        maxTokens: 1000,
        systemPrompt: 'You are a helpful assistant',
      };

      const callbacks: AIStreamCallbacks = {
        onContent: vi.fn(),
        onComplete: vi.fn(),
      };

      const response = await mockClient.streamChat(messages, options, callbacks);

      expect(mockClient.streamChat).toHaveBeenCalledWith(messages, options, callbacks);
      expect(callbacks.onContent).toHaveBeenCalledWith('Streaming content');
      expect(callbacks.onComplete).toHaveBeenCalledWith({
        content: [{ type: 'text', text: 'Complete response' }],
      });
      expect(response).toEqual({
        content: [{ type: 'text', text: 'Mock streaming response' }],
      });
    });
  });

  describe('createAiClient', () => {
    it('should throw a "Not implemented" error', () => {
      expect(() => createAiClient()).toThrow('Not implemented');
    });
  });
});
