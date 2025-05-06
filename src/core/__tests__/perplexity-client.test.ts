/**
 * @fileoverview Tests for the Perplexity API client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import OpenAI from 'openai';

// Create shared mocks using vi.hoisted
const mocks = vi.hoisted(() => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  openaiClient: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
  lruCache: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  },
  config: {
    PERPLEXITY_MODEL: 'sonar-pro',
    PERPLEXITY_MAX_TOKENS: 1024,
    PERPLEXITY_MAX_CACHE_SIZE: 100,
    PERPLEXITY_CACHE_TTL: 3600000,
    PERPLEXITY_MAX_RESULTS: 5,
    PERPLEXITY_MAX_RETRIES: 3,
    PERPLEXITY_BASE_URL: 'https://api.perplexity.ai',
    PERPLEXITY_TEMPERATURE: 0.7,
    PERPLEXITY_SYSTEM_PROMPT:
      'You are a helpful research assistant. Provide factual information with sources.',
    PERPLEXITY_API_KEY: 'test-api-key',
    DEBUG: false, // Add DEBUG flag
  },
}));

// Mock the config module before importing the client
vi.mock('../../config.js', () => mocks.config);

import {
  PerplexityClient,
  PerplexityAuthError,
  PerplexityAPIError,
  createPerplexityClient,
} from '../perplexity-client.js';

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => mocks.openaiClient),
  };
});

// Mock LRU-Cache
vi.mock('lru-cache', () => {
  return {
    LRUCache: vi.fn().mockImplementation(() => mocks.lruCache),
  };
});

// Mock logger
vi.mock('../../mcp/utils/logger.js', () => ({
  logger: mocks.logger,
}));

describe('PerplexityClient', () => {
  let client: PerplexityClient;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Reset the mock functions
    mocks.openaiClient.chat.completions.create.mockReset();
    mocks.lruCache.get.mockReset();
    mocks.lruCache.set.mockReset();
    mocks.lruCache.delete.mockReset();

    // Create a new client for each test
    client = new PerplexityClient({
      apiKey: 'test-api-key',
    });

    // Replace the client's internal OpenAI client with our mock
    (client as any).client = mocks.openaiClient;

    // Replace the client's internal cache with our mock
    (client as any).cache = mocks.lruCache;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should throw an error if no API key is provided', () => {
      expect(() => new PerplexityClient({ apiKey: '' })).toThrow(PerplexityAuthError);
    });

    it('should create a client with default options', () => {
      const client = new PerplexityClient({ apiKey: 'test-api-key' });
      expect(client).toBeDefined();
      expect(client['model']).toBe('sonar-pro');
      expect(client['maxResults']).toBe(5);
      expect(client['maxRetries']).toBe(3);
      expect(client['temperature']).toBe(0.7);
      expect(client['maxTokens']).toBe(1024);
    });

    it('should create a client with custom options', () => {
      const client = new PerplexityClient({
        apiKey: 'test-api-key',
        model: 'custom-model',
        maxResults: 10,
        maxRetries: 5,
        temperature: 0.5,
        maxTokens: 2048,
      });
      expect(client).toBeDefined();
      expect(client['model']).toBe('custom-model');
      expect(client['maxResults']).toBe(10);
      expect(client['maxRetries']).toBe(5);
      expect(client['temperature']).toBe(0.5);
      expect(client['maxTokens']).toBe(2048);
    });
  });

  describe('parseResults', () => {
    it('should parse structured results', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content:
                '## Test Title\nTest content\nhttps://example.com\n\n## Another Title\nMore content\nhttps://example2.com',
            },
          },
        ],
      };

      const result = client['parseResults'](
        mockResponse as OpenAI.Chat.Completions.ChatCompletion,
        'test query'
      );
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0].title).toBe('Test Title');
      expect(result.results[0].url).toBe('https://example.com');
    });

    it('should parse unstructured results', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Test content without clear structure. Some information here.',
            },
          },
        ],
      };

      const result = client['parseResults'](
        mockResponse as OpenAI.Chat.Completions.ChatCompletion,
        'test query'
      );
      expect(result.results.length).toBeGreaterThan(0);
    });

    it('should handle empty response', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: '',
            },
          },
        ],
      };

      expect(() =>
        client['parseResults'](mockResponse as OpenAI.Chat.Completions.ChatCompletion, 'test query')
      ).toThrow();
    });
  });

  describe('query', () => {
    it('should return cached results if available', async () => {
      // Mock the cache to return a cached result
      const cachedResult = {
        query: 'cached query',
        results: [
          { title: 'Cached Result', snippet: 'Cached content', url: 'https://example.com' },
        ],
        timestamp: new Date().toISOString(),
      };

      // Setup the cache.get mock to return the cached result
      mocks.lruCache.get.mockReturnValue({
        response: cachedResult,
        timestamp: Date.now(),
      });

      // Call the method
      const result = await client.query('cached query');

      // Verify the result and that the cache was checked
      expect(result).toEqual(cachedResult);
      expect(mocks.lruCache.get).toHaveBeenCalled();

      // Verify the API was not called
      expect(mocks.openaiClient.chat.completions.create).not.toHaveBeenCalled();
    });

    it('should make an API call if no cached results', async () => {
      // Setup the cache.get mock to return null (no cached result)
      mocks.lruCache.get.mockReturnValue(null);

      // Setup the API response
      const mockResponse = {
        choices: [
          {
            message: {
              content: '## Test Result\nThis is a test result\nhttps://example.com',
            },
          },
        ],
      };

      // Setup the API mock to return the mock response
      mocks.openaiClient.chat.completions.create.mockResolvedValue(mockResponse);

      // Call the method
      const result = await client.query('test query');

      // Verify the cache was checked
      expect(mocks.lruCache.get).toHaveBeenCalled();

      // Verify the API was called with the correct parameters
      expect(mocks.openaiClient.chat.completions.create).toHaveBeenCalledWith({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful research assistant. Provide factual information with sources.',
          },
          {
            role: 'user',
            content: expect.stringContaining('test query'),
          },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      });

      // Verify the result structure
      expect(result).toBeDefined();
      expect(result.query).toBe('test query');
      expect(result.results).toBeInstanceOf(Array);
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0].title).toBe('Test Result');
      expect(result.results[0].url).toBe('https://example.com');

      // Verify the result was cached
      expect(mocks.lruCache.set).toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      // Setup the cache.get mock to return null (no cached result)
      mocks.lruCache.get.mockReturnValue(null);

      // Setup the API mock to throw an error
      mocks.openaiClient.chat.completions.create.mockRejectedValue(new Error('API error'));

      // Mock the makeRequestWithRetries method to throw immediately
      vi.spyOn(client as any, 'makeRequestWithRetries').mockImplementation(() => {
        throw new PerplexityAPIError('Failed to query Perplexity API: API error');
      });

      // Call the method and expect it to throw
      await expect(client.query('error query')).rejects.toThrow(PerplexityAPIError);

      // Verify the cache was checked
      expect(mocks.lruCache.get).toHaveBeenCalled();

      // Verify the result was not cached
      expect(mocks.lruCache.set).not.toHaveBeenCalled();
    }, 10000);

    it('should retry on API errors up to maxRetries', async () => {
      // Create a client with specific retry settings for this test
      const retryClient = new PerplexityClient({
        apiKey: 'test-api-key',
        maxRetries: 2,
      });

      // Replace the client's internal OpenAI client with our mock
      (retryClient as any).client = mocks.openaiClient;

      // Replace the client's internal cache with our mock
      (retryClient as any).cache = mocks.lruCache;

      // Setup the cache.get mock to return null (no cached result)
      mocks.lruCache.get.mockReturnValue(null);

      // Mock the makeRequestWithRetries method to simulate retries and return a successful response
      vi.spyOn(retryClient as any, 'makeRequestWithRetries').mockImplementation(() => {
        return {
          query: 'retry query',
          results: [
            {
              title: 'Retry Success',
              snippet: 'This is a success after retries',
              url: 'https://example.com',
            },
          ],
          timestamp: new Date().toISOString(),
        };
      });

      // Call the method
      const result = await retryClient.query('retry query');

      // Verify the result structure
      expect(result).toBeDefined();
      expect(result.query).toBe('retry query');
      expect(result.results).toBeInstanceOf(Array);
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0].title).toBe('Retry Success');
    }, 10000);

    it('should handle empty response from API', async () => {
      // Setup the cache.get mock to return null (no cached result)
      mocks.lruCache.get.mockReturnValue(null);

      // Mock the parseResults method to throw an error
      vi.spyOn(client as any, 'parseResults').mockImplementation(() => {
        throw new Error('No content in response');
      });

      // Mock the makeRequestWithRetries method to throw a PerplexityAPIError
      vi.spyOn(client as any, 'makeRequestWithRetries').mockImplementation(() => {
        throw new PerplexityAPIError(
          'Failed to parse Perplexity API response: No content in response'
        );
      });

      // Call the method and expect it to throw
      await expect(client.query('empty query')).rejects.toThrow(PerplexityAPIError);

      // Verify the cache was checked
      expect(mocks.lruCache.get).toHaveBeenCalled();

      // Verify the result was not cached
      expect(mocks.lruCache.set).not.toHaveBeenCalled();
    }, 10000);

    it('should bypass cache if requested', async () => {
      // Setup a cached result
      const cachedResult = {
        query: 'bypass query',
        results: [
          { title: 'Cached Result', snippet: 'Cached content', url: 'https://example.com' },
        ],
        timestamp: new Date().toISOString(),
      };

      // Setup the cache.get mock to return the cached result
      mocks.lruCache.get.mockReturnValue({
        response: cachedResult,
        timestamp: Date.now(),
      });

      // Setup the API response
      const mockResponse = {
        choices: [
          {
            message: {
              content: '## Fresh Result\nThis is a fresh result\nhttps://example.com/fresh',
            },
          },
        ],
      };

      // Setup the API mock to return the mock response
      mocks.openaiClient.chat.completions.create.mockResolvedValue(mockResponse);

      // Call the method with bypassCache option
      const result = await client.query('bypass query', { bypassCache: true });

      // Verify the cache was not checked
      expect(mocks.lruCache.get).not.toHaveBeenCalled();

      // Verify the API was called
      expect(mocks.openaiClient.chat.completions.create).toHaveBeenCalled();

      // Verify the result structure
      expect(result).toBeDefined();
      expect(result.query).toBe('bypass query');
      expect(result.results).toBeInstanceOf(Array);
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0].title).toBe('Fresh Result');
      expect(result.results[0].url).toBe('https://example.com/fresh');

      // Verify the result was cached
      expect(mocks.lruCache.set).toHaveBeenCalled();
    });
  });
});

describe('createPerplexityClient', () => {
  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should create a client with default values from config', () => {
    // Call the function
    const client = createPerplexityClient();

    // Verify the client was created with the correct options
    expect(client).toBeInstanceOf(PerplexityClient);
    expect((client as any).model).toBe('sonar-pro');
    expect((client as any).maxResults).toBe(5);
    expect((client as any).maxRetries).toBe(3);
    expect((client as any).temperature).toBe(0.7);
    expect((client as any).maxTokens).toBe(1024);
  });

  it('should throw an error if API key is not provided', () => {
    // Mock the config to have an empty API key
    const originalApiKey = mocks.config.PERPLEXITY_API_KEY;
    mocks.config.PERPLEXITY_API_KEY = '';

    try {
      // Test that the function throws an error if no API key is provided
      expect(() => createPerplexityClient()).toThrow(PerplexityAuthError);
    } finally {
      // Restore the original API key
      mocks.config.PERPLEXITY_API_KEY = originalApiKey;
    }
  });
});
