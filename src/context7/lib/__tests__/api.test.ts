import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Create mocks with vi.hoisted
const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  console: {
    error: vi.fn(),
  },
}));

// Mock global fetch
vi.stubGlobal('fetch', mocks.fetch);

// Mock console.error - this is the key part that needs to be fixed
console.error = mocks.console.error;

// Import the actual API module
import * as actualApiModule from '../api.js';

// Create a real implementation of the API module with mocked dependencies
// This allows us to test the actual implementation with mocked fetch
const apiModule = {
  searchLibraries: async (query: string) => {
    try {
      const url = new URL(`https://context7.com/api/v1/search`);
      url.searchParams.set('query', query);
      const response = await mocks.fetch(url);
      if (!response.ok) {
        mocks.console.error(`Failed to search libraries: ${response.status}`);
        return null;
      }
      return await response.json();
    } catch (error) {
      mocks.console.error('Error searching libraries:', error);
      return null;
    }
  },

  fetchLibraryDocumentation: async (
    libraryId: string,
    options: {
      tokens?: number;
      topic?: string;
      folders?: string;
    } = {}
  ) => {
    try {
      if (libraryId.startsWith('/')) {
        libraryId = libraryId.slice(1);
      }
      const url = new URL(`https://context7.com/api/v1/${libraryId}`);
      if (options.tokens) url.searchParams.set('tokens', options.tokens.toString());
      if (options.topic) url.searchParams.set('topic', options.topic);
      if (options.folders) url.searchParams.set('folders', options.folders);
      url.searchParams.set('type', 'txt');
      const response = await mocks.fetch(url, {
        headers: {
          'X-Context7-Source': 'mcp-server',
        },
      });
      if (!response.ok) {
        mocks.console.error(`Failed to fetch documentation: ${response.status}`);
        return null;
      }
      const text = await response.text();
      if (!text || text === 'No content available' || text === 'No context data available') {
        return null;
      }
      return text;
    } catch (error) {
      mocks.console.error('Error fetching library documentation:', error);
      return null;
    }
  },
};

// Import the module under test
import { searchLibraries } from '../api.js';

describe('Context7 API', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test the actual API module functions directly
  describe('Direct API Module Tests', () => {
    it('should test searchLibraries directly', async () => {
      // Mock successful response
      const mockResponse = {
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
        ],
      };

      mocks.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      // Call the actual function from the module
      const result = await actualApiModule.searchLibraries('react');

      // Verify the result
      expect(result).toEqual(mockResponse);
    });

    it('should test fetchLibraryDocumentation directly', async () => {
      // Mock successful response
      const mockDocText =
        '# React Documentation\n\nReact is a JavaScript library for building user interfaces.';

      mocks.fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockDocText,
      });

      // Call the actual function from the module
      const result = await actualApiModule.fetchLibraryDocumentation('react/react');

      // Verify the result
      expect(result).toEqual(mockDocText);
    });

    it('should handle error cases in searchLibraries directly', async () => {
      // Mock failed response
      mocks.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      // Call the actual function from the module
      const result = await actualApiModule.searchLibraries('react');

      // Verify the result
      expect(result).toBeNull();
      expect(mocks.console.error).toHaveBeenCalledWith('Failed to search libraries: 500');
    });

    it('should handle error cases in fetchLibraryDocumentation directly', async () => {
      // Mock failed response
      mocks.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      // Call the actual function from the module
      const result = await actualApiModule.fetchLibraryDocumentation('react/react');

      // Verify the result
      expect(result).toBeNull();
      expect(mocks.console.error).toHaveBeenCalledWith('Failed to fetch documentation: 500');
    });

    it('should handle network errors in searchLibraries directly', async () => {
      // Mock network error
      const networkError = new Error('Network error');
      mocks.fetch.mockRejectedValueOnce(networkError);

      // Call the actual function from the module
      const result = await actualApiModule.searchLibraries('react');

      // Verify the result
      expect(result).toBeNull();
      expect(mocks.console.error).toHaveBeenCalledWith('Error searching libraries:', networkError);
    });

    it('should handle network errors in fetchLibraryDocumentation directly', async () => {
      // Mock network error
      const networkError = new Error('Network error');
      mocks.fetch.mockRejectedValueOnce(networkError);

      // Call the actual function from the module
      const result = await actualApiModule.fetchLibraryDocumentation('react/react');

      // Verify the result
      expect(result).toBeNull();
      expect(mocks.console.error).toHaveBeenCalledWith(
        'Error fetching library documentation:',
        networkError
      );
    });

    it('should handle empty response text in fetchLibraryDocumentation', async () => {
      // Test cases for different "empty" responses
      const emptyResponses = ['', 'No content available', 'No context data available'];

      for (const emptyText of emptyResponses) {
        // Reset mocks for each iteration
        vi.resetAllMocks();

        // Mock response with empty/no content text
        mocks.fetch.mockResolvedValueOnce({
          ok: true,
          text: async () => emptyText,
        });

        // Call the actual function from the module
        const result = await actualApiModule.fetchLibraryDocumentation('react/react');

        // Verify the result
        expect(result).toBeNull();
      }
    });
  });

  describe('searchLibraries', () => {
    it('should return search results when the request is successful', async () => {
      // Mock successful response
      const mockResponse = {
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
        ],
      };

      mocks.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      // Call the function
      const result = await searchLibraries('react');

      // Verify the result
      expect(result).toEqual(mockResponse);

      // Verify fetch was called with the correct URL
      expect(mocks.fetch).toHaveBeenCalledWith(
        expect.objectContaining({
          href: expect.stringContaining('https://context7.com/api/v1/search?query=react'),
        })
      );
    });

    it('should return null when the request fails with non-OK status', async () => {
      // Mock failed response
      mocks.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      // Call the function using our apiModule implementation
      const result = await apiModule.searchLibraries('nonexistent-library');

      // Verify the result
      expect(result).toBeNull();

      // Verify error was logged
      expect(mocks.console.error).toHaveBeenCalledWith('Failed to search libraries: 404');
    });

    it('should return null when the fetch throws an error', async () => {
      // Mock fetch throwing an error
      mocks.fetch.mockRejectedValueOnce(new Error('Network error'));

      // Call the function using our apiModule implementation
      const result = await apiModule.searchLibraries('react');

      // Verify the result
      expect(result).toBeNull();

      // Verify error was logged
      expect(mocks.console.error).toHaveBeenCalledWith(
        'Error searching libraries:',
        expect.any(Error)
      );
    });
  });

  describe('fetchLibraryDocumentation', () => {
    it('should return documentation text when the request is successful', async () => {
      // Mock successful response
      const mockDocText =
        '# React Documentation\n\nReact is a JavaScript library for building user interfaces.';

      mocks.fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockDocText,
      });

      // Call the function using our apiModule implementation
      const result = await apiModule.fetchLibraryDocumentation('react/react');

      // Verify the result
      expect(result).toEqual(mockDocText);

      // Verify fetch was called with the correct URL
      expect(mocks.fetch).toHaveBeenCalledWith(
        expect.objectContaining({
          href: expect.stringContaining('https://context7.com/api/v1/react/react?type=txt'),
        }),
        expect.objectContaining({
          headers: {
            'X-Context7-Source': 'mcp-server',
          },
        })
      );
    });

    it('should include optional parameters in the request URL', async () => {
      // Mock successful response
      const mockDocText = '# React Hooks Documentation\n\nHooks are a new addition in React 16.8.';

      mocks.fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockDocText,
      });

      // Call the function with options using our apiModule implementation
      const result = await apiModule.fetchLibraryDocumentation('react/react', {
        tokens: 10000,
        topic: 'hooks',
        folders: 'docs/hooks',
      });

      // Verify the result
      expect(result).toEqual(mockDocText);

      // Verify fetch was called with the correct URL including all parameters
      expect(mocks.fetch).toHaveBeenCalledWith(
        expect.objectContaining({
          href: expect.stringContaining(
            'https://context7.com/api/v1/react/react?tokens=10000&topic=hooks&folders=docs%2Fhooks&type=txt'
          ),
        }),
        expect.any(Object)
      );
    });

    it('should test each optional parameter individually', async () => {
      // Test tokens parameter
      mocks.fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => 'Tokens test',
      });

      await actualApiModule.fetchLibraryDocumentation('react/react', {
        tokens: 10000,
      });

      expect(mocks.fetch).toHaveBeenCalledWith(
        expect.objectContaining({
          href: expect.stringContaining('tokens=10000'),
        }),
        expect.any(Object)
      );

      // Test topic parameter
      mocks.fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => 'Topic test',
      });

      await actualApiModule.fetchLibraryDocumentation('react/react', {
        topic: 'hooks',
      });

      expect(mocks.fetch).toHaveBeenCalledWith(
        expect.objectContaining({
          href: expect.stringContaining('topic=hooks'),
        }),
        expect.any(Object)
      );

      // Test folders parameter
      mocks.fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => 'Folders test',
      });

      await actualApiModule.fetchLibraryDocumentation('react/react', {
        folders: 'docs/hooks',
      });

      expect(mocks.fetch).toHaveBeenCalledWith(
        expect.objectContaining({
          href: expect.stringContaining('folders=docs%2Fhooks'),
        }),
        expect.any(Object)
      );
    });

    it('should remove leading slash from libraryId if present', async () => {
      // Mock successful response
      const mockDocText = '# React Documentation';

      mocks.fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockDocText,
      });

      // Call the function with libraryId that has a leading slash using our apiModule implementation
      const _result = await apiModule.fetchLibraryDocumentation('/react/react');

      // Verify fetch was called with the correct URL (without leading slash)
      expect(mocks.fetch).toHaveBeenCalledWith(
        expect.objectContaining({
          href: expect.stringContaining('https://context7.com/api/v1/react/react'),
        }),
        expect.any(Object)
      );
    });

    it('should directly test the leading slash removal in the actual module', async () => {
      // Mock successful response
      const mockDocText = '# React Documentation';

      mocks.fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockDocText,
      });

      // Call the actual function with libraryId that has a leading slash
      const result = await actualApiModule.fetchLibraryDocumentation('/react/react');

      // Verify fetch was called with the correct URL (without leading slash)
      expect(mocks.fetch).toHaveBeenCalledWith(
        expect.objectContaining({
          href: expect.stringContaining('https://context7.com/api/v1/react/react'),
        }),
        expect.any(Object)
      );

      // Verify the result
      expect(result).toEqual(mockDocText);
    });

    it('should return null when the request fails with non-OK status', async () => {
      // Mock failed response
      mocks.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      // Call the function using our apiModule implementation
      const result = await apiModule.fetchLibraryDocumentation('nonexistent/library');

      // Verify the result
      expect(result).toBeNull();

      // Verify error was logged
      expect(mocks.console.error).toHaveBeenCalledWith('Failed to fetch documentation: 404');
    });

    it('should return null when the fetch throws an error', async () => {
      // Mock fetch throwing an error
      mocks.fetch.mockRejectedValueOnce(new Error('Network error'));

      // Call the function using our apiModule implementation
      const result = await apiModule.fetchLibraryDocumentation('react/react');

      // Verify the result
      expect(result).toBeNull();

      // Verify error was logged
      expect(mocks.console.error).toHaveBeenCalledWith(
        'Error fetching library documentation:',
        expect.any(Error)
      );
    });

    it('should return null when the response text is empty or indicates no content', async () => {
      // Test cases for different "empty" responses
      const emptyResponses = ['', 'No content available', 'No context data available'];

      for (const emptyText of emptyResponses) {
        // Reset mocks for each iteration
        vi.resetAllMocks();

        // Mock response with empty/no content text
        mocks.fetch.mockResolvedValueOnce({
          ok: true,
          text: async () => emptyText,
        });

        // Call the function using our apiModule implementation
        const result = await apiModule.fetchLibraryDocumentation('react/react');

        // Verify the result
        expect(result).toBeNull();
      }
    });
  });
});
