/**
 * @fileoverview Perplexity API client for research-backed updates
 * This module provides a client for interacting with the Perplexity API
 * It includes error handling, rate limiting, and caching
 */

import OpenAI from 'openai';
import { LRUCache } from 'lru-cache';
import { logger } from '../mcp/utils/logger.js';
import { AIError, ErrorCode } from '../types/errors.js';
import {
  PERPLEXITY_API_KEY,
  PERPLEXITY_MODEL,
  PERPLEXITY_MAX_TOKENS,
  PERPLEXITY_SYSTEM_PROMPT,
  PERPLEXITY_MAX_RESULTS,
  PERPLEXITY_MAX_CACHE_SIZE,
  PERPLEXITY_CACHE_TTL,
  PERPLEXITY_MAX_RETRIES,
  PERPLEXITY_BASE_URL,
  PERPLEXITY_TEMPERATURE,
} from '../config.js';

/**
 * Result from a Perplexity API query
 */
export interface PerplexityResult {
  title: string;
  snippet: string;
  url: string;
}

/**
 * Response from a Perplexity API query
 */
export interface PerplexityResponse {
  query: string;
  results: PerplexityResult[];
  timestamp: string;
}

/**
 * Options for Perplexity API client
 */
export interface PerplexityClientOptions {
  /** API key for authentication */
  apiKey: string;
  /** Model to use for queries (default: 'sonar-medium-online') */
  model?: string;
  /** Maximum number of results to return (default: 5) */
  maxResults?: number;
  /** Maximum size of the cache (default: 100) */
  maxCacheSize?: number;
  /** Time-to-live for cache entries in milliseconds (default: 1 hour) */
  cacheTTL?: number;
  /** Maximum number of retries for failed requests (default: 3) */
  maxRetries?: number;
  /** Base URL for the API (default: 'https://api.perplexity.ai') */
  baseURL?: string;
  /** Temperature for the API request (default: 0.7) */
  temperature?: number;
  /** Maximum tokens for the API response (default: 1024) */
  maxTokens?: number;
  /** System prompt for the API request */
  systemPrompt?: string;
}

/**
 * Cache entry for Perplexity API responses
 */
interface CacheEntry {
  /** The cached response */
  response: PerplexityResponse;
  /** Timestamp when the entry was cached */
  timestamp: number;
}

/**
 * Error thrown when there's an issue with the Perplexity API
 */
export class PerplexityAPIError extends AIError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.EXTERNAL_API_ERROR, details);
    this.name = 'PerplexityAPIError';
  }
}

/**
 * Error thrown when the Perplexity API rate limit is exceeded
 */
export class PerplexityRateLimitError extends AIError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.AI_RATE_LIMIT, details);
    this.name = 'PerplexityRateLimitError';
  }
}

/**
 * Error thrown when there's an authentication issue with the Perplexity API
 */
export class PerplexityAuthError extends AIError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.EXTERNAL_API_ERROR, details);
    this.name = 'PerplexityAuthError';
  }
}

/**
 * Client for interacting with the Perplexity API
 */
export class PerplexityClient {
  /** OpenAI client instance */
  private client: OpenAI;
  /** Model to use for queries */
  private model: string;
  /** Maximum number of results to return */
  private maxResults: number;
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
   * Create a new Perplexity API client
   * @param options - Client options
   */
  constructor(options: PerplexityClientOptions) {
    const {
      apiKey,
      model = PERPLEXITY_MODEL,
      maxResults = PERPLEXITY_MAX_RESULTS,
      maxCacheSize = PERPLEXITY_MAX_CACHE_SIZE,
      cacheTTL = PERPLEXITY_CACHE_TTL,
      maxRetries = PERPLEXITY_MAX_RETRIES,
      baseURL = PERPLEXITY_BASE_URL,
      temperature = PERPLEXITY_TEMPERATURE,
      maxTokens = PERPLEXITY_MAX_TOKENS,
      systemPrompt = PERPLEXITY_SYSTEM_PROMPT,
    } = options;

    if (!apiKey) {
      throw new PerplexityAuthError('Perplexity API key is required');
    }

    this.client = new OpenAI({
      apiKey,
      baseURL,
    });

    this.model = model;
    this.maxResults = maxResults;
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
   * Query the Perplexity API for research results
   * @param query - The query to research
   * @param options - Query options
   * @returns Research results
   */
  async query(query: string, options?: { bypassCache?: boolean }): Promise<PerplexityResponse> {
    const { bypassCache = false } = options || {};

    // Check cache if not bypassing
    if (!bypassCache) {
      const cachedResponse = this.getCachedResponse(query);
      if (cachedResponse) {
        logger.debug(`Cache hit for query: ${query}`);
        return cachedResponse;
      }
    }

    // Check rate limits
    this.checkRateLimits();

    // Make API request with retries
    return this.makeRequestWithRetries(query);
  }

  /**
   * Get a cached response for a query
   * @param query - The query to check
   * @returns The cached response or null if not found
   */
  private getCachedResponse(query: string): PerplexityResponse | null {
    const cacheKey = this.getCacheKey(query);
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
   * Get a cache key for a query
   * @param query - The query to get a key for
   * @returns The cache key
   */
  private getCacheKey(query: string): string {
    // Simple cache key based on the query
    return `perplexity:${query}`;
  }

  /**
   * Cache a response for a query
   * @param query - The query to cache
   * @param response - The response to cache
   */
  private cacheResponse(query: string, response: PerplexityResponse): void {
    const cacheKey = this.getCacheKey(query);
    this.cache.set(cacheKey, {
      response,
      timestamp: Date.now(),
    });
  }

  /**
   * Check rate limits before making a request
   * @throws PerplexityRateLimitError if rate limit is exceeded
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

      throw new PerplexityRateLimitError(
        `Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)} seconds.`,
        { resetTime, waitTime }
      );
    }

    // Increment request counter
    this.requestCount++;
  }

  /**
   * Make a request to the Perplexity API with retries
   * @param query - The query to research
   * @returns Research results
   */
  private async makeRequestWithRetries(query: string): Promise<PerplexityResponse> {
    let lastError: Error | null = null;
    let delay = 1000; // Start with 1 second delay

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          logger.debug(`Retry attempt ${attempt} for query: ${query}`);
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, delay));
          // Exponential backoff
          delay *= 2;
        }

        return await this.makeRequest(query);
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on authentication errors
        if (error instanceof PerplexityAuthError) {
          throw error;
        }

        // Don't retry on rate limit errors
        if (error instanceof PerplexityRateLimitError) {
          throw error;
        }

        logger.warn(
          `Error in Perplexity API request (attempt ${attempt + 1}/${this.maxRetries + 1}): ${lastError.message}`
        );
      }
    }

    // If we get here, all retries failed
    throw (
      lastError || new PerplexityAPIError('Failed to query Perplexity API after multiple attempts')
    );
  }

  /**
   * Make a request to the Perplexity API
   * @param query - The query to research
   * @returns Research results
   */
  private async makeRequest(query: string): Promise<PerplexityResponse> {
    try {
      logger.debug(`Querying Perplexity API with: ${query}`);

      // Make the API request
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.systemPrompt,
          },
          {
            role: 'user',
            content: this.formatPrompt(query),
          },
        ],
        temperature: this.temperature,
        max_tokens: this.maxTokens,
      });

      logger.debug('Received response from Perplexity API');

      // Parse the response
      const results = this.parseResults(response, query);

      // Cache the response
      this.cacheResponse(query, results);

      return results;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error in Perplexity API: ${errorMessage}`);

      // Throw appropriate error based on the error message
      if (errorMessage.includes('authentication') || errorMessage.includes('API key')) {
        throw new PerplexityAuthError(`Authentication error: ${errorMessage}`);
      } else if (errorMessage.includes('rate limit')) {
        throw new PerplexityRateLimitError(`Rate limit exceeded: ${errorMessage}`);
      } else if (errorMessage.includes('model')) {
        throw new PerplexityAPIError(`Invalid model: ${errorMessage}`);
      } else if (errorMessage.includes('parameter')) {
        throw new PerplexityAPIError(`Invalid parameter: ${errorMessage}`);
      } else if (errorMessage.includes('server')) {
        throw new PerplexityAPIError(`Server error: ${errorMessage}`);
      } else {
        throw new PerplexityAPIError(`Failed to query Perplexity API: ${errorMessage}`);
      }
    }
  }

  /**
   * Format a prompt for the Perplexity API
   * @param query - The query to format
   * @returns Formatted prompt
   */
  private formatPrompt(query: string): string {
    return `Research the following topic and provide detailed information with sources. Format your response as a list of findings with clear titles, detailed explanations, and source URLs: ${query}`;
  }

  /**
   * Parse results from a Perplexity API response
   * @param response - The API response
   * @param query - The original query
   * @returns Parsed results
   */
  private parseResults(
    response: OpenAI.Chat.Completions.ChatCompletion,
    query: string
  ): PerplexityResponse {
    try {
      // Extract the content from the response
      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No content in response');
      }

      // Parse the content to extract results
      const results: PerplexityResult[] = [];

      // Try to extract structured results
      // This is a more sophisticated parsing approach

      // First, try to find sections with titles and URLs
      const sectionRegex =
        /(?:^|\n)(?:##?\s+)?([^#\n].+?)(?:\n|$)(?:([^#\n].*?)(?:\n|$))+?(?:(?:https?:\/\/[^\s)]+)|(?:\[.*?\]\((https?:\/\/[^\s)]+)\)))/gm;
      let match;

      while ((match = sectionRegex.exec(content)) !== null && results.length < this.maxResults) {
        // Extract the title from the first capture group
        const title = match[1].trim();

        // Extract the URL
        const urlMatch = match[0].match(
          /(?:https?:\/\/[^\s)]+)|(?:\[.*?\]\((https?:\/\/[^\s)]+)\))/
        );
        const url = urlMatch
          ? urlMatch[0].replace(/\[.*?\]\((https?:\/\/[^\s)]+)\)/, '$1')
          : 'https://perplexity.ai';

        // Extract the snippet (everything between title and URL)
        const snippetMatch = match[0]
          .substring(title.length)
          .match(/([\s\S]+?)(?:(?:https?:\/\/)|(?:\[.*?\]\())/);
        const snippet = snippetMatch ? snippetMatch[1].trim() : match[0].trim();

        results.push({
          title,
          snippet,
          url,
        });
      }

      // If we couldn't extract structured results, fall back to a simpler approach
      if (results.length === 0) {
        // Split the content by paragraphs
        const paragraphs = content.split('\n\n');

        // Extract results from paragraphs
        for (let i = 0; i < paragraphs.length && results.length < this.maxResults; i++) {
          const paragraph = paragraphs[i].trim();
          if (paragraph) {
            // Extract URL if present
            const urlMatch = paragraph.match(/https?:\/\/[^\s)]+/);
            const url = urlMatch ? urlMatch[0] : 'https://perplexity.ai';

            // Extract title
            const titleMatch = paragraph.match(/^(.+?)(?:\.|:)/);
            const title = titleMatch ? titleMatch[1].trim() : 'Research Result';

            // Use the paragraph as the snippet
            const snippet = paragraph;

            results.push({
              title,
              snippet,
              url,
            });
          }
        }
      }

      // If we still couldn't extract results, create a generic result
      if (results.length === 0) {
        results.push({
          title: 'Research Results',
          snippet: content.substring(0, 500) + (content.length > 500 ? '...' : ''),
          url: 'https://perplexity.ai',
        });
      }

      return {
        query,
        results,
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error parsing Perplexity API response: ${errorMessage}`);
      throw new PerplexityAPIError(`Failed to parse Perplexity API response: ${errorMessage}`);
    }
  }
}

/**
 * Create a Perplexity client from environment variables
 * @returns Perplexity client
 */
export function createPerplexityClient(): PerplexityClient {
  const apiKey = PERPLEXITY_API_KEY;
  const model = PERPLEXITY_MODEL;
  const maxResults = PERPLEXITY_MAX_RESULTS;
  const maxCacheSize = PERPLEXITY_MAX_CACHE_SIZE;
  const cacheTTL = PERPLEXITY_CACHE_TTL;
  const maxRetries = PERPLEXITY_MAX_RETRIES;
  const baseURL = PERPLEXITY_BASE_URL;
  const temperature = PERPLEXITY_TEMPERATURE;
  const maxTokens = PERPLEXITY_MAX_TOKENS;
  const systemPrompt = PERPLEXITY_SYSTEM_PROMPT;

  if (!apiKey) {
    throw new PerplexityAuthError('PERPLEXITY_API_KEY environment variable is not set');
  }

  return new PerplexityClient({
    apiKey,
    model,
    maxResults,
    maxCacheSize,
    cacheTTL,
    maxRetries,
    baseURL,
    temperature,
    maxTokens,
    systemPrompt,
  });
}
