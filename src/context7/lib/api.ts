import type { SearchResponse } from './types.js';
import { logger } from '../../mcp/utils/logger.js';

const CONTEXT7_API_BASE_URL = 'https://context7.com/api';
const DEFAULT_TYPE = 'txt';

/**
 * Searches for libraries matching the given query
 * @param query The search query
 * @returns Search results or null if the request fails
 */
export async function searchLibraries(query: string): Promise<SearchResponse | null> {
  try {
    const url = new URL(`${CONTEXT7_API_BASE_URL}/v1/search`);
    url.searchParams.set('query', query);
    const response = await fetch(url);
    if (!response.ok) {
      logger.error(`Failed to search libraries: ${response.status}`);
      return null;
    }
    return (await response.json()) as SearchResponse;
  } catch (error) {
    logger.error('Error searching libraries:', error);
    return null;
  }
}

/**
 * Fetches documentation context for a specific library
 * @param libraryId The library ID to fetch documentation for
 * @param options Options for the request
 * @returns The documentation text or null if the request fails
 */
export async function fetchLibraryDocumentation(
  libraryId: string,
  options: {
    tokens?: number;
    topic?: string;
    folders?: string;
  } = {}
): Promise<string | null> {
  try {
    if (libraryId.startsWith('/')) {
      libraryId = libraryId.slice(1);
    }
    const url = new URL(`${CONTEXT7_API_BASE_URL}/v1/${libraryId}`);
    if (options.tokens) url.searchParams.set('tokens', options.tokens.toString());
    if (options.topic) url.searchParams.set('topic', options.topic);
    if (options.folders) url.searchParams.set('folders', options.folders);
    url.searchParams.set('type', DEFAULT_TYPE);
    const response = await fetch(url, {
      headers: {
        'X-Context7-Source': 'mcp-server',
      },
    });
    if (!response.ok) {
      logger.error(`Failed to fetch documentation: ${response.status}`);
      return null;
    }
    const text = await response.text();
    if (!text || text === 'No content available' || text === 'No context data available') {
      return null;
    }
    return text;
  } catch (error) {
    logger.error('Error fetching library documentation:', error);
    return null;
  }
}
