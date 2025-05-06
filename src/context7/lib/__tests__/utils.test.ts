import { describe, it, expect } from 'vitest';
import { formatSearchResult, formatSearchResults } from '../utils.js';
import type { SearchResult, SearchResponse } from '../types.js';

describe('Context7 Utils', () => {
  describe('formatSearchResult', () => {
    it('should format a search result correctly', () => {
      // Create a mock search result
      const mockResult: SearchResult = {
        id: 'react/react',
        title: 'React',
        description: 'A JavaScript library for building user interfaces',
        branch: 'main',
        lastUpdate: '2023-01-01',
        state: 'finalized',
        totalTokens: 10000,
        totalSnippets: 100,
        totalPages: 50,
      };

      // Call the function
      const formattedResult = formatSearchResult(mockResult);

      // Verify the result
      expect(formattedResult).toEqual(
        'Title: React\n\nContext7-compatible library ID: react/react\n\nDescription: A JavaScript library for building user interfaces'
      );
    });

    it('should handle undefined description', () => {
      // Create a mock search result without description
      const mockResult: SearchResult = {
        id: 'react/react',
        title: 'React',
        branch: 'main',
        lastUpdate: '2023-01-01',
        state: 'finalized',
        totalTokens: 10000,
        totalSnippets: 100,
        totalPages: 50,
      };

      // Call the function
      const formattedResult = formatSearchResult(mockResult);

      // Verify the result
      expect(formattedResult).toEqual(
        'Title: React\n\nContext7-compatible library ID: react/react\n\nDescription: undefined'
      );
    });
  });

  describe('formatSearchResults', () => {
    it('should format multiple search results correctly', () => {
      // Create mock search results
      const mockResponse: SearchResponse = {
        results: [
          {
            id: 'react/react',
            title: 'React',
            description: 'A JavaScript library for building user interfaces',
            branch: 'main',
            lastUpdate: '2023-01-01',
            state: 'finalized',
            totalTokens: 10000,
            totalSnippets: 100,
            totalPages: 50,
          },
          {
            id: 'vue/vue',
            title: 'Vue',
            description: 'Progressive JavaScript framework',
            branch: 'main',
            lastUpdate: '2023-01-02',
            state: 'finalized',
            totalTokens: 8000,
            totalSnippets: 80,
            totalPages: 40,
          },
        ],
      };

      // Call the function
      const formattedResults = formatSearchResults(mockResponse);

      // Verify the result
      expect(formattedResults).toEqual(
        'Title: React\n\nContext7-compatible library ID: react/react\n\nDescription: A JavaScript library for building user interfaces\n\n--------------------\nTitle: Vue\n\nContext7-compatible library ID: vue/vue\n\nDescription: Progressive JavaScript framework'
      );
    });

    it('should handle empty results array', () => {
      // Create mock response with empty results
      const mockResponse: SearchResponse = {
        results: [],
      };

      // Call the function
      const formattedResults = formatSearchResults(mockResponse);

      // Verify the result
      expect(formattedResults).toEqual('No documentation libraries found matching your query.');
    });

    it('should handle undefined results array', () => {
      // Create mock response with undefined results
      const mockResponse = {} as SearchResponse;

      // Call the function
      const formattedResults = formatSearchResults(mockResponse);

      // Verify the result
      expect(formattedResults).toEqual('No documentation libraries found matching your query.');
    });
  });
});
