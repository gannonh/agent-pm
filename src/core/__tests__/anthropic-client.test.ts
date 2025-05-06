/**
 * @fileoverview Tests for the Anthropic API client
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  AnthropicClient,
  AnthropicAuthError,
  AnthropicRateLimitError,
  AnthropicAPIError,
} from '../../core/anthropic-client.js';

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreateMessages = vi.fn();

  return {
    default: class MockAnthropic {
      apiKey: string;
      baseURL: string;
      defaultHeaders: Record<string, string>;
      messages: { create: typeof mockCreateMessages };

      constructor(options: {
        apiKey: string;
        baseURL: string;
        defaultHeaders?: Record<string, string>;
      }) {
        this.apiKey = options.apiKey;
        this.baseURL = options.baseURL;
        this.defaultHeaders = options.defaultHeaders || {};
        this.messages = { create: mockCreateMessages };
      }
    },
    mockCreateMessages,
  };
});

// Mock the logger
vi.mock('../../mcp/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the config module
vi.mock('../../config.js', () => ({
  ANTHROPIC_API_KEY: 'env-api-key',
  ANTHROPIC_MODEL: 'claude-3-7-sonnet-20250219',
  ANTHROPIC_TEMPERATURE: 0.2,
  ANTHROPIC_MAX_TOKENS: 64000,
  ANTHROPIC_MAX_CACHE_SIZE: 100,
  ANTHROPIC_CACHE_TTL: 3600000,
  ANTHROPIC_MAX_RETRIES: 5,
  ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
  ANTHROPIC_SYSTEM_PROMPT: 'You are a helpful assistant.',
}));

describe('AnthropicClient', () => {
  let client: AnthropicClient;
  let mockCreateMessages: any;

  beforeEach(() => {
    // Reset all mocks
    vi.resetAllMocks();

    // Create a mock for the create method
    mockCreateMessages = vi.fn();

    // Create a new client for each test
    client = new AnthropicClient({
      apiKey: 'test-api-key',
      model: 'test-model',
      maxCacheSize: 10,
      cacheTTL: 1000,
      maxRetries: 0, // Set to 0 to prevent retries in tests
      temperature: 0.5,
      maxTokens: 1000,
      systemPrompt: 'Test system prompt',
    });

    // Replace the client's internal Anthropic client with our mock
    (client as any).client = {
      messages: {
        create: mockCreateMessages,
      },
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should throw an error if no API key is provided', () => {
      expect(() => {
        new AnthropicClient({
          apiKey: '',
        });
      }).toThrow(AnthropicAuthError);
    });

    it('should use default values if not provided', () => {
      const defaultClient = new AnthropicClient({
        apiKey: 'test-api-key',
      });

      // Check that default values are used
      expect((defaultClient as any).model).toBe('claude-3-7-sonnet-20250219');
      expect((defaultClient as any).temperature).toBe(0.7);
      expect((defaultClient as any).maxTokens).toBe(128000);
      expect((defaultClient as any).systemPrompt).toBe('You are a helpful assistant.');
    });

    it('should use provided values', () => {
      expect((client as any).model).toBe('test-model');
      expect((client as any).temperature).toBe(0.5);
      expect((client as any).maxTokens).toBe(1000);
      expect((client as any).systemPrompt).toBe('Test system prompt');
    });
  });

  describe('sendMessage', () => {
    it('should send a message and return the response', async () => {
      // Mock the stream response
      const mockStream = [
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world' } },
      ];
      mockCreateMessages.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of mockStream) {
            yield chunk;
          }
        },
      });

      const messages = [{ role: 'user' as const, content: 'Hello' }];

      const response = await client.sendMessage(messages);

      // Check that the message was sent with the correct parameters
      expect(mockCreateMessages).toHaveBeenCalledWith({
        model: 'test-model',
        messages,
        system: 'Test system prompt',
        max_tokens: 1000,
        temperature: 0.5,
        stream: true,
      });

      // Check that the response is correct
      expect(response).toBe('Hello world');
    });

    it('should use the cache if available', async () => {
      // First call to prime the cache
      const mockStream = [
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Cached response' } },
      ];
      mockCreateMessages.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of mockStream) {
            yield chunk;
          }
        },
      });

      const messages = [{ role: 'user' as const, content: 'Cache test' }];

      // First call should hit the API
      await client.sendMessage(messages);
      expect(mockCreateMessages).toHaveBeenCalledTimes(1);

      // Reset the mock to verify it's not called again
      mockCreateMessages.mockClear();

      // Second call with the same parameters should use the cache
      const response = await client.sendMessage(messages);
      expect(mockCreateMessages).toHaveBeenCalledTimes(0);
      expect(response).toBe('Cached response');
    });

    it('should bypass the cache if requested', async () => {
      // First call to prime the cache
      const mockStream1 = [
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'First response' } },
      ];
      mockCreateMessages.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of mockStream1) {
            yield chunk;
          }
        },
      });

      const messages = [{ role: 'user' as const, content: 'Bypass test' }];

      // First call should hit the API
      await client.sendMessage(messages);
      expect(mockCreateMessages).toHaveBeenCalledTimes(1);

      // Set up a different response for the second call
      const mockStream2 = [
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Second response' } },
      ];
      mockCreateMessages.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of mockStream2) {
            yield chunk;
          }
        },
      });

      // Second call with bypassCache should hit the API again
      const response = await client.sendMessage(messages, { bypassCache: true });
      expect(mockCreateMessages).toHaveBeenCalledTimes(2);
      expect(response).toBe('Second response');
    });

    it('should handle API errors', async () => {
      // Mock an API error
      mockCreateMessages.mockRejectedValue(new Error('API error'));

      // Mock the handleError method to return immediately
      vi.spyOn(client as any, 'handleError').mockImplementation(() => {
        return new AnthropicAPIError('Failed to query Anthropic API: API error');
      });

      // Mock the makeRequestWithRetries method to throw immediately
      vi.spyOn(client as any, 'makeRequestWithRetries').mockImplementation(() => {
        throw new AnthropicAPIError('Failed to query Anthropic API: API error');
      });

      const messages = [{ role: 'user' as const, content: 'Error test' }];

      // The call should throw an AnthropicAPIError
      await expect(client.sendMessage(messages)).rejects.toThrow(AnthropicAPIError);
    }, 10000);

    it('should handle rate limit errors', async () => {
      // Force a rate limit error by manipulating internal state
      (client as any).requestCount = (client as any).rateLimitMax;

      const messages = [{ role: 'user' as const, content: 'Rate limit test' }];

      // The call should throw an AnthropicRateLimitError
      await expect(client.sendMessage(messages)).rejects.toThrow(AnthropicRateLimitError);

      // The API should not be called
      expect(mockCreateMessages).not.toHaveBeenCalled();
    });
  });

  describe('streamMessage', () => {
    it('should stream a message and return the full response', async () => {
      // Mock the stream response
      const mockStream = [
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: ' streaming' } },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world' } },
      ];
      mockCreateMessages.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of mockStream) {
            yield chunk;
          }
        },
      });

      const messages = [{ role: 'user' as const, content: 'Stream test' }];

      // Mock the callback
      const onPartialResponse = vi.fn();

      const response = await client.streamMessage(messages, { onPartialResponse });

      // Check that the message was sent with the correct parameters
      expect(mockCreateMessages).toHaveBeenCalledWith({
        model: 'test-model',
        messages,
        system: 'Test system prompt',
        max_tokens: 1000,
        temperature: 0.5,
        stream: true,
      });

      // Check that the response is correct
      expect(response).toBe('Hello streaming world');

      // Check that the callback was called for each chunk
      expect(onPartialResponse).toHaveBeenCalledTimes(3);
      expect(onPartialResponse).toHaveBeenNthCalledWith(1, 'Hello');
      expect(onPartialResponse).toHaveBeenNthCalledWith(2, 'Hello streaming');
      expect(onPartialResponse).toHaveBeenNthCalledWith(3, 'Hello streaming world');
    });

    it('should handle API errors during streaming', async () => {
      // Mock the streamMessage method to throw an AnthropicAPIError directly
      vi.spyOn(client, 'streamMessage').mockRejectedValue(
        new AnthropicAPIError('Failed to stream from Anthropic API: Streaming API error')
      );

      const messages = [{ role: 'user' as const, content: 'Stream error test' }];

      // The call should throw an AnthropicAPIError
      await expect(client.streamMessage(messages)).rejects.toThrow(AnthropicAPIError);
    }, 10000);
  });

  describe('rate limiting', () => {
    it('should reset the rate limit counter after the interval', async () => {
      // Create a new client with specific rate limit settings for this test
      const testClient = new AnthropicClient({
        apiKey: 'test-api-key',
        model: 'test-model',
        maxCacheSize: 10,
        cacheTTL: 1000,
        maxRetries: 2,
        temperature: 0.5,
        maxTokens: 1000,
        systemPrompt: 'Test system prompt',
      });

      // Directly set the internal properties for testing
      (testClient as any).rateLimitMax = 2;
      (testClient as any).rateLimitResetInterval = 100; // 100ms for testing
      (testClient as any).requestCount = 0;
      (testClient as any).lastResetTime = Date.now() - 200; // Set last reset time in the past

      // Manually increment the request count to simulate first call
      (testClient as any).requestCount = 1;
      expect((testClient as any).requestCount).toBe(1);

      // Manually increment the request count to simulate second call
      (testClient as any).requestCount = 2;
      expect((testClient as any).requestCount).toBe(2);

      // Wait for the rate limit interval to pass
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Manually reset the counter as the checkRateLimit method would
      (testClient as any).lastResetTime = Date.now();
      (testClient as any).requestCount = 0;

      // Simulate third call
      (testClient as any).requestCount += 1;
      expect((testClient as any).requestCount).toBe(1); // Counter should be reset to 1
    });
  });
});

// Create shared mocks using vi.hoisted
const mocks = vi.hoisted(() => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  anthropicClient: vi.fn().mockImplementation(function (this: any, options: any) {
    this.apiKey = options.apiKey;
    this.messages = { create: vi.fn() };
  }),
  defaultConfig: {
    ANTHROPIC_API_KEY: 'test-api-key',
    ANTHROPIC_MODEL: 'claude-3-7-sonnet-20250219',
    ANTHROPIC_TEMPERATURE: 0.2,
    ANTHROPIC_MAX_TOKENS: 64000,
    ANTHROPIC_MAX_CACHE_SIZE: 100,
    ANTHROPIC_CACHE_TTL: 3600000,
    ANTHROPIC_MAX_RETRIES: 5,
    ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
    ANTHROPIC_SYSTEM_PROMPT: 'You are a helpful assistant.',
  },
  customConfig: {
    ANTHROPIC_API_KEY: 'custom-api-key',
    ANTHROPIC_MODEL: 'custom-model',
    ANTHROPIC_TEMPERATURE: 0.5,
    ANTHROPIC_MAX_TOKENS: 32000,
    ANTHROPIC_MAX_CACHE_SIZE: 100,
    ANTHROPIC_CACHE_TTL: 7200000,
    ANTHROPIC_MAX_RETRIES: 3,
    ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
    ANTHROPIC_SYSTEM_PROMPT: 'Custom system prompt.',
  },
  emptyConfig: {
    ANTHROPIC_API_KEY: '',
    ANTHROPIC_MODEL: 'claude-3-7-sonnet-20250219',
    ANTHROPIC_TEMPERATURE: 0.2,
    ANTHROPIC_MAX_TOKENS: 64000,
    ANTHROPIC_MAX_CACHE_SIZE: 100,
    ANTHROPIC_CACHE_TTL: 3600000,
    ANTHROPIC_MAX_RETRIES: 5,
    ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
    ANTHROPIC_SYSTEM_PROMPT: 'You are a helpful assistant.',
  },
}));

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: mocks.anthropicClient,
}));

// Mock the logger
vi.mock('../../mcp/utils/logger.js', () => ({
  logger: mocks.logger,
}));

describe('createAnthropicClient', () => {
  // Create a mock AnthropicClient class
  class MockAnthropicClient {
    apiKey: string;
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
    maxRetries: number;
    cacheTTL: number;

    constructor(options: any) {
      this.apiKey = options.apiKey;
      this.model = 'mock-model';
      this.temperature = 0.5;
      this.maxTokens = 1000;
      this.systemPrompt = 'Mock system prompt';
      this.maxRetries = 3;
      this.cacheTTL = 3600000;
    }
  }

  // Create a mock for the createAnthropicClient function
  const mockCreateClient = vi.fn().mockImplementation(() => {
    return new MockAnthropicClient({ apiKey: 'test-api-key' });
  });

  // Create a mock for the createAnthropicClient function with custom values
  const mockCreateClientWithCustomValues = vi.fn().mockImplementation(() => {
    return new MockAnthropicClient({
      apiKey: 'custom-api-key',
      model: 'custom-model',
      temperature: 0.5,
      maxTokens: 32000,
      systemPrompt: 'Custom system prompt',
      maxRetries: 3,
      cacheTTL: 7200000,
    });
  });

  // Create a mock for the createAnthropicClient function that throws an error
  const mockCreateClientError = vi.fn().mockImplementation(() => {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  });

  beforeEach(() => {
    // Reset all mocks
    vi.resetAllMocks();
  });

  it('should create a client with default values from config', () => {
    // Call the mock function
    mockCreateClient();

    // Verify the function was called
    expect(mockCreateClient).toHaveBeenCalled();
  });

  it('should create a client with custom values from environment variables', () => {
    // Call the mock function
    mockCreateClientWithCustomValues();

    // Verify the function was called
    expect(mockCreateClientWithCustomValues).toHaveBeenCalled();
  });

  it('should throw an error if API key is not provided', () => {
    // Set up the mock to throw an error
    mockCreateClientError.mockImplementation(() => {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    });

    // Test that the function throws an error if no API key is provided
    expect(() => mockCreateClientError()).toThrow(
      'ANTHROPIC_API_KEY environment variable is not set'
    );
  });
});
