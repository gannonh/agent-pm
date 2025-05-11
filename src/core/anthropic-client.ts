/**
 * @fileoverview Anthropic API client for interactive conversations
 * This module provides a client for interacting with the Anthropic API
 * It includes error handling, rate limiting, and caching
 */
import Anthropic from '@anthropic-ai/sdk';
import { LRUCache } from 'lru-cache';
import { logger } from '../mcp/utils/logger.js';
import { AIError, ErrorCode } from '../types/errors.js';
import {
  ANTHROPIC_API_KEY,
  ANTHROPIC_TEMPERATURE,
  ANTHROPIC_MAX_TOKENS,
  ANTHROPIC_MODEL,
  ANTHROPIC_MAX_CACHE_SIZE,
  ANTHROPIC_CACHE_TTL,
  ANTHROPIC_MAX_RETRIES,
  ANTHROPIC_BASE_URL,
  ANTHROPIC_SYSTEM_PROMPT,
} from '../config.js';

/**
 * Message from Anthropic API
 */
export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Options for Anthropic API client
 */
export interface AnthropicClientOptions {
  /** API key for authentication */
  apiKey: string;
  /** Model to use for queries (default: 'claude-3-opus-20240229') */
  model?: string;
  /** Maximum size of the cache (default: 100) */
  maxCacheSize?: number;
  /** Time-to-live for cache entries in milliseconds (default: 1 hour) */
  cacheTTL?: number;
  /** Maximum number of retries for failed requests (default: 3) */
  maxRetries?: number;
  /** Base URL for the API (default: 'https://api.anthropic.com') */
  baseURL?: string;
  /** Temperature for the API request (default: 0.7) */
  temperature?: number;
  /** Maximum tokens for the API response (default: 4096) */
  maxTokens?: number;
  /** System prompt for the API request */
  systemPrompt?: string;
}

/**
 * Cache entry for Anthropic API responses
 */
interface CacheEntry {
  /** The cached response */
  response: string;
  /** Timestamp when the entry was cached */
  timestamp: number;
}

/**
 * Error thrown when there's an issue with the Anthropic API
 */
export class AnthropicAPIError extends AIError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.AI_API_ERROR, details);
    this.name = 'AnthropicAPIError';
  }
}

/**
 * Error thrown when the Anthropic API rate limit is exceeded
 */
export class AnthropicRateLimitError extends AIError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.AI_RATE_LIMIT, details);
    this.name = 'AnthropicRateLimitError';
  }
}

/**
 * Error thrown when there's an authentication issue with the Anthropic API
 */
export class AnthropicAuthError extends AIError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.EXTERNAL_API_ERROR, details);
    this.name = 'AnthropicAuthError';
  }
}

/**
 * Client for interacting with the Anthropic API
 */
export class AnthropicClient {
  /** Anthropic client instance */
  private client: Anthropic;
  /** Model to use for queries */
  private model: string;
  /** Cache for API responses */
  private cache: LRUCache<string, CacheEntry>;
  /** Time-to-live for cache entries in milliseconds */
  private cacheTTL: number;
  /** Maximum number of retries for failed requests */
  private maxRetries: number;
  /** Current request count for rate limiting */
  private requestCount: number;
  /** Timestamp of the last rate limit reset */
  private lastResetTime: number;
  /** Interval for resetting the rate limit counter in milliseconds */
  private rateLimitResetInterval: number;
  /** Maximum number of requests allowed per interval */
  private rateLimitMax: number;
  /** Temperature for the API request */
  private temperature: number;
  /** Maximum tokens for the API response */
  private maxTokens: number;
  /** System prompt for the API request */
  private systemPrompt: string;

  /**
   * Create a new Anthropic API client
   * @param options - Client options
   */
  constructor(options: AnthropicClientOptions) {
    const {
      apiKey,
      model = 'claude-3-7-sonnet-20250219',
      maxCacheSize = 100,
      cacheTTL = 3600000, // 1 hour in milliseconds
      maxRetries = 3,
      baseURL = 'https://api.anthropic.com',
      temperature = 0.7,
      maxTokens = 128000, // Using full 128k token output capability
      systemPrompt = 'You are a helpful assistant.',
    } = options;

    if (!apiKey) {
      throw new AnthropicAuthError('Anthropic API key is required');
    }

    this.client = new Anthropic({
      apiKey,
      baseURL,
      defaultHeaders: {
        'anthropic-beta': 'output-128k-2025-02-19',
      },
    });

    this.model = model;
    this.maxRetries = maxRetries;
    this.cacheTTL = cacheTTL;
    this.temperature = temperature;
    this.maxTokens = maxTokens;
    this.systemPrompt = systemPrompt;

    // Initialize cache
    this.cache = new LRUCache<string, CacheEntry>({
      max: maxCacheSize,
    });

    // Initialize rate limiting
    this.requestCount = 0;
    this.lastResetTime = Date.now();
    this.rateLimitResetInterval = 60000; // 1 minute
    this.rateLimitMax = 10; // Default to 10 requests per minute
  }

  /**
   * Send a message to the Anthropic API
   * @param messages - The messages to send
   * @param options - Message options
   * @returns The response from the API
   */
  async sendMessage(
    messages: AnthropicMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
      bypassCache?: boolean;
    }
  ): Promise<string> {
    const {
      temperature = this.temperature,
      maxTokens = this.maxTokens,
      systemPrompt = this.systemPrompt,
      bypassCache = false,
    } = options || {};

    // Create a cache key from the messages and options
    const cacheKey = this.getCacheKey(messages, {
      temperature,
      maxTokens,
      systemPrompt,
    });

    // Check cache if not bypassing
    if (!bypassCache) {
      const cachedResponse = this.getCachedResponse(cacheKey);
      if (cachedResponse) {
        logger.debug('Cache hit for message');
        return cachedResponse;
      }
    }

    // Check rate limits
    this.checkRateLimits();

    // Use the makeRequestWithRetries method to handle retries
    return this.makeRequestWithRetries(messages, {
      temperature,
      maxTokens,
      systemPrompt,
      cacheKey,
    });
  }

  /**
   * Get a cached response for a cache key
   * @param cacheKey - The cache key to check
   * @returns The cached response or null if not found
   */
  private getCachedResponse(cacheKey: string): string | null {
    const cachedEntry = this.cache.get(cacheKey);

    if (cachedEntry) {
      // Check if cache entry is still valid
      const now = Date.now();
      if (now - cachedEntry.timestamp <= this.cacheTTL) {
        return cachedEntry.response;
      }
      // Remove expired entry
      this.cache.delete(cacheKey);
    }

    return null;
  }

  /**
   * Get a cache key for messages and options
   * @param messages - The messages to get a key for
   * @param options - The options to include in the key
   * @returns The cache key
   */
  private getCacheKey(
    messages: AnthropicMessage[],
    options: {
      temperature: number;
      maxTokens: number;
      systemPrompt: string;
    }
  ): string {
    // Create a deterministic string representation of the messages and options
    const messagesString = JSON.stringify(messages);
    const optionsString = JSON.stringify(options);
    return `anthropic:${messagesString}:${optionsString}`;
  }

  /**
   * Cache a response for a cache key
   * @param cacheKey - The cache key to use
   * @param response - The response to cache
   */
  private cacheResponse(cacheKey: string, response: string): void {
    this.cache.set(cacheKey, {
      response,
      timestamp: Date.now(),
    });
  }

  /**
   * Check rate limits before making a request
   * @throws AnthropicRateLimitError if rate limit is exceeded
   */
  private checkRateLimits(): void {
    const now = Date.now();

    // Reset counter if interval has passed
    if (now - this.lastResetTime > this.rateLimitResetInterval) {
      this.requestCount = 0;
      this.lastResetTime = now;
    }

    // Check if we've hit the rate limit
    if (this.requestCount >= this.rateLimitMax) {
      const resetTime = this.lastResetTime + this.rateLimitResetInterval;
      const waitTime = resetTime - now;

      throw new AnthropicRateLimitError(
        `Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)} seconds.`,
        { resetTime, waitTime }
      );
    }

    // Increment request counter
    this.requestCount++;
  }

  /**
   * Handle API errors and convert them to appropriate error types
   * @param error - The error to handle
   * @returns A typed error
   */
  private handleError(error: unknown): Error {
    if (
      error instanceof AnthropicAuthError ||
      error instanceof AnthropicRateLimitError ||
      error instanceof AnthropicAPIError
    ) {
      return error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorString = JSON.stringify(error);

    // Check for authentication errors
    if (
      errorMessage.includes('auth') ||
      errorMessage.includes('authentication') ||
      errorMessage.includes('apiKey') ||
      errorMessage.includes('api key') ||
      errorString.includes('auth')
    ) {
      return new AnthropicAuthError(`Authentication error with Anthropic API: ${errorMessage}`);
    }

    // Check for rate limit errors
    if (
      errorMessage.includes('rate') ||
      errorMessage.includes('limit') ||
      errorMessage.includes('too many') ||
      errorString.includes('rate_limit')
    ) {
      return new AnthropicRateLimitError(`Rate limit exceeded with Anthropic API: ${errorMessage}`);
    }

    // Default to general API error
    return new AnthropicAPIError(`Failed to query Anthropic API: ${errorMessage}`);
  }

  /**
   * Make a request to the Anthropic API with retries
   * @param messages - The messages to send
   * @param options - Request options
   * @returns The response from the API
   */
  private async makeRequestWithRetries(
    messages: AnthropicMessage[],
    options: {
      temperature: number;
      maxTokens: number;
      systemPrompt: string;
      cacheKey: string;
    }
  ): Promise<string> {
    let lastError: Error | null = null;
    let delay = 2000; // Start with 2 second delay for overloaded servers
    const maxRetries = this.maxRetries + 2; // Add extra retries for overloaded errors

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // Log retry attempt with more details
          logger.info(`Retry attempt ${attempt}/${maxRetries} with delay ${delay}ms`, {
            attempt,
            maxRetries,
            delay,
            errorMessage: lastError?.message || 'Unknown error',
            errorType: lastError?.name || 'Unknown',
          });

          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, delay));

          // Exponential backoff with jitter to prevent thundering herd
          const jitter = Math.random() * 0.3 + 0.85; // Random value between 0.85 and 1.15
          delay = Math.min(delay * 2 * jitter, 60000); // Cap at 60 seconds
        }

        // Always use streaming
        logger.debug('Using streaming mode for Anthropic API request (retry)', {
          messageCount: messages.length,
          attempt,
          temperature: options.temperature,
          maxTokens: options.maxTokens,
        });

        // Create a streaming request
        const stream = await this.client.messages.create({
          model: this.model,
          messages,
          system: options.systemPrompt,
          max_tokens: options.maxTokens,
          temperature: options.temperature,
          stream: true,
        });

        // Collect the streamed response
        let fullContent = '';
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
            fullContent += chunk.delta.text;
          }
        }

        // Cache the response
        this.cacheResponse(options.cacheKey, fullContent);

        // Log successful completion after retries if this wasn't the first attempt
        if (attempt > 0) {
          logger.info(`Successfully completed request after ${attempt} retries`);
        }

        return fullContent;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorMessage = lastError.message;
        const errorString = JSON.stringify(error);

        // Don't retry on authentication errors
        if (error instanceof AnthropicAuthError) {
          throw error;
        }

        // Special handling for overloaded errors - retry with longer backoff
        if (
          errorMessage.includes('overloaded') ||
          errorString.includes('overloaded_error') ||
          errorString.includes('Overloaded')
        ) {
          logger.warn(
            `Anthropic API overloaded (attempt ${attempt + 1}/${maxRetries + 1}). Retrying with longer backoff.`,
            { errorMessage, attempt, maxRetries, delay }
          );

          // Use a longer delay for overloaded errors
          delay = Math.max(delay, 5000);
          continue;
        }

        // Don't retry on rate limit errors
        if (error instanceof AnthropicRateLimitError) {
          throw error;
        }

        // For other errors, log and continue retrying
        logger.warn(
          `Error in Anthropic API request (attempt ${attempt + 1}/${maxRetries + 1}): ${errorMessage}`,
          { error, attempt, maxRetries }
        );
      }
    }

    // If we get here, all retries failed
    logger.error(`Failed to query Anthropic API after ${maxRetries} attempts`, {
      lastError,
      messages: messages.length,
    });

    throw (
      lastError || new AnthropicAPIError('Failed to query Anthropic API after multiple attempts')
    );
  }

  /**
   * Stream a response from the Anthropic API
   * @param messages - The messages to send
   * @param options - Stream options
   * @returns A stream of responses from the API
   */
  async streamMessage(
    messages: AnthropicMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
      onPartialResponse?: (text: string) => void;
    }
  ): Promise<string> {
    const {
      temperature = this.temperature,
      maxTokens = this.maxTokens,
      systemPrompt = this.systemPrompt,
      onPartialResponse,
    } = options || {};

    // Check rate limits
    this.checkRateLimits();

    // Create a cache key for potential future caching if we implement caching for streaming
    // const cacheKey = this.getCacheKey(messages, {
    //   temperature,
    //   maxTokens,
    //   systemPrompt,
    // });

    let lastError: Error | null = null;
    let delay = 2000; // Start with 2 second delay for overloaded servers
    const maxRetries = this.maxRetries + 2; // Add extra retries for overloaded errors

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // Log retry attempt with more details
          logger.info(
            `Retry attempt ${attempt}/${maxRetries} with delay ${delay}ms for streaming request`,
            {
              attempt,
              maxRetries,
              delay,
              errorMessage: lastError?.message || 'Unknown error',
              errorType: lastError?.name || 'Unknown',
            }
          );

          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, delay));

          // Exponential backoff with jitter to prevent thundering herd
          const jitter = Math.random() * 0.3 + 0.85; // Random value between 0.85 and 1.15
          delay = Math.min(delay * 2 * jitter, 60000); // Cap at 60 seconds
        }

        logger.debug('Streaming message to Anthropic API', {
          messageCount: messages.length,
          firstMessageRole: messages[0]?.role,
          lastMessageRole: messages[messages.length - 1]?.role,
          temperature,
          maxTokens,
          systemPrompt: systemPrompt?.substring(0, 50) + '...',
          attempt,
        });

        // Make the API request
        const stream = await this.client.messages.create({
          model: this.model,
          messages,
          system: systemPrompt,
          temperature,
          max_tokens: maxTokens,
          stream: true,
        });

        let fullResponse = '';

        // Process the stream
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
            fullResponse += chunk.delta.text;

            // Call the callback if provided
            if (onPartialResponse) {
              onPartialResponse(fullResponse);
            }
          }
        }

        logger.debug('Completed streaming response from Anthropic API');

        // Log successful completion after retries if this wasn't the first attempt
        if (attempt > 0) {
          logger.info(`Successfully completed streaming request after ${attempt} retries`);
        }

        return fullResponse;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorMessage = lastError.message;
        const errorString = JSON.stringify(error);

        // Don't retry on authentication errors
        if (error instanceof AnthropicAuthError) {
          throw error;
        }

        // Special handling for overloaded errors - retry with longer backoff
        if (
          errorMessage.includes('overloaded') ||
          errorString.includes('overloaded_error') ||
          errorString.includes('Overloaded')
        ) {
          logger.warn(
            `Anthropic API overloaded (attempt ${attempt + 1}/${maxRetries + 1}). Retrying streaming request with longer backoff.`,
            { errorMessage, attempt, maxRetries, delay }
          );

          // Use a longer delay for overloaded errors
          delay = Math.max(delay, 5000);
          continue;
        }

        // Don't retry on rate limit errors
        if (error instanceof AnthropicRateLimitError) {
          throw error;
        }

        // For other errors, log and continue retrying
        logger.warn(
          `Error in Anthropic API streaming request (attempt ${attempt + 1}/${maxRetries + 1}): ${errorMessage}`,
          { error, attempt, maxRetries }
        );
      }
    }

    // If we get here, all retries failed
    logger.error(`Failed to stream from Anthropic API after ${maxRetries} attempts`, {
      lastError,
      messages: messages.length,
    });

    throw (
      lastError ||
      new AnthropicAPIError('Failed to stream from Anthropic API after multiple attempts')
    );
  }
}

/**
 * Create an Anthropic client from environment variables
 * @returns Anthropic client
 */
// Import config at the top of the file instead

export function createAnthropicClient(): AnthropicClient {
  const apiKey = ANTHROPIC_API_KEY;
  const model = ANTHROPIC_MODEL;
  const maxCacheSize = ANTHROPIC_MAX_CACHE_SIZE;
  const cacheTTL = ANTHROPIC_CACHE_TTL;
  const maxRetries = ANTHROPIC_MAX_RETRIES;
  const baseURL = ANTHROPIC_BASE_URL;
  const temperature = ANTHROPIC_TEMPERATURE;
  const maxTokens = ANTHROPIC_MAX_TOKENS;
  const systemPrompt = ANTHROPIC_SYSTEM_PROMPT;

  if (!apiKey) {
    throw new AnthropicAuthError('ANTHROPIC_API_KEY environment variable is not set');
  }

  // Log the configuration for debugging
  logger.debug('Creating Anthropic client with 128k token output capability:', {
    model,
    maxTokens,
    temperature,
    maxCacheSize,
    cacheTTL,
    maxRetries,
    envModel: ANTHROPIC_MODEL,
    envAnthropicModel: ANTHROPIC_MODEL,
    envMaxTokens: ANTHROPIC_MAX_TOKENS,
    envAnthropicMaxTokens: ANTHROPIC_MAX_TOKENS,
  });

  return new AnthropicClient({
    apiKey,
    model,
    maxCacheSize,
    cacheTTL,
    maxRetries,
    baseURL,
    temperature,
    maxTokens,
    systemPrompt,
  });
}
