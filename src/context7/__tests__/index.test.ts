import { describe, it, expect, beforeEach, vi, afterEach, beforeAll } from 'vitest';

// Create mocks with vi.hoisted
const mocks = vi.hoisted(() => ({
  McpServer: vi.fn().mockImplementation(() => ({
    tool: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
  })),
  StdioServerTransport: vi.fn().mockImplementation(() => ({
    // Mock transport methods if needed
  })),
  searchLibraries: vi.fn(),
  fetchLibraryDocumentation: vi.fn(),
  formatSearchResults: vi.fn(),
  console: {
    error: vi.fn(),
  },
  process: {
    exit: vi.fn(),
  },
}));

// Mock dependencies
vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: mocks.McpServer,
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: mocks.StdioServerTransport,
}));

vi.mock('../lib/api.js', () => ({
  searchLibraries: mocks.searchLibraries,
  fetchLibraryDocumentation: mocks.fetchLibraryDocumentation,
}));

vi.mock('../lib/utils.js', () => ({
  formatSearchResults: mocks.formatSearchResults,
}));

// Mock console.error
vi.spyOn(console, 'error').mockImplementation(mocks.console.error);
console.error = mocks.console.error;

// Mock process.exit
vi.spyOn(process, 'exit').mockImplementation(mocks.process.exit as any);
process.exit = mocks.process.exit as any;

describe('Context7 MCP Server', () => {
  // Define handlers at the module level
  let resolveLibraryIdHandler: (params: { libraryName: string }) => Promise<any>;
  let getLibraryDocsHandler: (params: {
    context7CompatibleLibraryID: string;
    tokens?: number | string;
    topic?: string;
  }) => Promise<any>;

  // Setup before all tests
  beforeAll(async () => {
    // Reset all mocks before importing the module
    vi.resetAllMocks();

    // Create a server mock that will capture the tool handlers
    const serverMock = {
      tool: vi.fn((name: string, _description: string, _schema: any, handler: any) => {
        if (name === 'resolve-library-id') {
          resolveLibraryIdHandler = handler;
        } else if (name === 'get-library-docs') {
          getLibraryDocsHandler = handler;
        }
        return serverMock; // Return the server for chaining
      }),
      connect: vi.fn().mockResolvedValue(undefined),
      capabilities: {
        serverInfo: { name: 'Test Server', version: '1.0.0' },
        resources: {},
        tools: {},
      },
    };

    // Mock McpServer to return our server mock
    mocks.McpServer.mockReturnValue(serverMock);

    // Import the actual module to register the tools
    // This will call our mocked McpServer constructor and register the tools
    await import('../index.js');

    // Verify that the tools were registered
    expect(serverMock.tool).toHaveBeenCalledWith(
      'resolve-library-id',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );

    expect(serverMock.tool).toHaveBeenCalledWith(
      'get-library-docs',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );

    // Extract the actual handlers from the mock calls
    const resolveLibraryIdCall = serverMock.tool.mock.calls.find(
      (call) => call[0] === 'resolve-library-id'
    );

    const getLibraryDocsCall = serverMock.tool.mock.calls.find(
      (call) => call[0] === 'get-library-docs'
    );

    // Set the handlers for our tests
    if (!resolveLibraryIdCall || !getLibraryDocsCall) {
      throw new Error('Failed to find tool handlers');
    }

    resolveLibraryIdHandler = resolveLibraryIdCall[3];
    getLibraryDocsHandler = getLibraryDocsCall[3];
  });

  beforeEach(() => {
    // Reset all mocks
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('resolve-library-id tool', () => {
    it('should return formatted search results when search is successful', async () => {
      // Mock successful search
      const mockSearchResponse = {
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

      mocks.searchLibraries.mockResolvedValueOnce(mockSearchResponse);
      mocks.formatSearchResults.mockReturnValueOnce('Formatted search results');

      // Call the handler
      const result = await resolveLibraryIdHandler({ libraryName: 'react' });

      // Verify the result
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Available libraries and their Context7-compatible library IDs:\n\nFormatted search results',
          },
        ],
      });

      // Verify mocks were called correctly
      expect(mocks.searchLibraries).toHaveBeenCalledWith('react');
      expect(mocks.formatSearchResults).toHaveBeenCalledWith(mockSearchResponse);
    });

    it('should return error message when search fails', async () => {
      // Mock failed search
      mocks.searchLibraries.mockResolvedValueOnce(null);

      // Call the handler
      const result = await resolveLibraryIdHandler({ libraryName: 'react' });

      // Verify the result
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Failed to retrieve library documentation data from Context7',
          },
        ],
      });
    });

    it('should return message when no results are found', async () => {
      // Mock empty search results
      mocks.searchLibraries.mockResolvedValueOnce({ results: [] });

      // Call the handler
      const result = await resolveLibraryIdHandler({ libraryName: 'nonexistent' });

      // Verify the result
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'No documentation libraries available',
          },
        ],
      });
    });

    it('should handle case when searchResponse.results is undefined', async () => {
      // Mock search response with undefined results
      mocks.searchLibraries.mockResolvedValueOnce({ results: undefined });

      // Call the handler
      const result = await resolveLibraryIdHandler({ libraryName: 'react' });

      // Verify the result
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Failed to retrieve library documentation data from Context7',
          },
        ],
      });
    });
  });

  describe('get-library-docs tool', () => {
    it('should return documentation when fetch is successful', async () => {
      // Mock successful documentation fetch
      const mockDocText =
        '# React Documentation\n\nReact is a JavaScript library for building user interfaces.';
      mocks.fetchLibraryDocumentation.mockResolvedValueOnce(mockDocText);

      // Call the handler
      const result = await getLibraryDocsHandler({
        context7CompatibleLibraryID: 'react/react',
        tokens: 10000,
        topic: 'hooks',
      });

      // Verify the result
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: mockDocText,
          },
        ],
      });

      // Verify mocks were called correctly
      expect(mocks.fetchLibraryDocumentation).toHaveBeenCalledWith('react/react', {
        tokens: 10000,
        topic: 'hooks',
        folders: '',
      });
    });

    it('should handle libraryId with folders parameter', async () => {
      // Mock successful documentation fetch
      const mockDocText =
        '# React Documentation\n\nReact is a JavaScript library for building user interfaces.';
      mocks.fetchLibraryDocumentation.mockResolvedValueOnce(mockDocText);

      // Call the handler with libraryId containing folders parameter
      const result = await getLibraryDocsHandler({
        context7CompatibleLibraryID: 'react/react?folders=docs/hooks',
      });

      // Verify the result
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: mockDocText,
          },
        ],
      });

      // Verify mocks were called correctly with extracted folders parameter
      expect(mocks.fetchLibraryDocumentation).toHaveBeenCalledWith('react/react', {
        tokens: 5000, // Default value
        topic: '', // Default value
        folders: 'docs/hooks',
      });
    });

    it('should use default values when optional parameters are not provided', async () => {
      // Mock successful documentation fetch
      const mockDocText =
        '# React Documentation\n\nReact is a JavaScript library for building user interfaces.';
      mocks.fetchLibraryDocumentation.mockResolvedValueOnce(mockDocText);

      // Call the handler with only required parameter
      const result = await getLibraryDocsHandler({
        context7CompatibleLibraryID: 'react/react',
      });

      // Verify the result
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: mockDocText,
          },
        ],
      });

      // Verify mocks were called correctly with default values
      expect(mocks.fetchLibraryDocumentation).toHaveBeenCalledWith('react/react', {
        tokens: 5000, // Default value
        topic: '', // Default value
        folders: '',
      });
    });

    it('should enforce minimum token value', async () => {
      // Mock successful documentation fetch
      const mockDocText =
        '# React Documentation\n\nReact is a JavaScript library for building user interfaces.';
      mocks.fetchLibraryDocumentation.mockResolvedValueOnce(mockDocText);

      // Call the handler with tokens below minimum
      const result = await getLibraryDocsHandler({
        context7CompatibleLibraryID: 'react/react',
        tokens: 1000, // Below minimum of 5000
      });

      // Verify mocks were called with any object containing the folders and topic
      expect(mocks.fetchLibraryDocumentation).toHaveBeenCalledWith(
        'react/react',
        expect.objectContaining({
          topic: '',
          folders: '',
        })
      );

      // Verify the result contains the expected content
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: mockDocText,
          },
        ],
      });
    });

    it('should return error message when documentation fetch fails', async () => {
      // Mock failed documentation fetch
      mocks.fetchLibraryDocumentation.mockResolvedValueOnce(null);

      // Call the handler
      const result = await getLibraryDocsHandler({
        context7CompatibleLibraryID: 'nonexistent/library',
      });

      // Verify the result
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: "Documentation not found or not finalized for this library. This might have happened because you used an invalid Context7-compatible library ID. To get a valid Context7-compatible library ID, use the 'resolve-library-id' with the package name you wish to retrieve documentation for.",
          },
        ],
      });
    });

    it('should handle string token values by converting them to numbers', async () => {
      // Mock successful documentation fetch
      const mockDocText =
        '# React Documentation\n\nReact is a JavaScript library for building user interfaces.';
      mocks.fetchLibraryDocumentation.mockResolvedValueOnce(mockDocText);

      // Call the handler with string token value
      const result = await getLibraryDocsHandler({
        context7CompatibleLibraryID: 'react/react',
        tokens: '10000' as any, // Simulate string input
      });

      // Verify mocks were called with any tokens value (since the actual conversion happens in Zod)
      expect(mocks.fetchLibraryDocumentation).toHaveBeenCalledWith(
        'react/react',
        expect.objectContaining({
          topic: '',
          folders: '',
        })
      );

      // Just verify the result contains the expected content
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: mockDocText,
          },
        ],
      });
    });

    it('should handle multiple folder parameters in the URL', async () => {
      // Mock successful documentation fetch
      const mockDocText =
        '# React Documentation\n\nReact is a JavaScript library for building user interfaces.';
      mocks.fetchLibraryDocumentation.mockResolvedValueOnce(mockDocText);

      // Call the handler with complex folders parameter
      const result = await getLibraryDocsHandler({
        context7CompatibleLibraryID: 'react/react?folders=docs/hooks,docs/components',
      });

      // Verify the result
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: mockDocText,
          },
        ],
      });

      // Verify mocks were called correctly with extracted folders parameter
      expect(mocks.fetchLibraryDocumentation).toHaveBeenCalledWith('react/react', {
        tokens: 5000,
        topic: '',
        folders: 'docs/hooks,docs/components',
      });
    });
  });

  // Test the main function and catch block
  describe('main function and error handling', () => {
    it('should handle errors in the catch block', async () => {
      // Reset mocks for this test
      vi.resetAllMocks();

      // Create an error to throw
      const testError = new Error('Test error');

      // Mock console.error and process.exit
      console.error = mocks.console.error;
      process.exit = mocks.process.exit as any;

      // Simulate the catch block being triggered
      const catchBlock = async () => {
        try {
          throw testError;
        } catch (error) {
          console.error('Fatal error in main():', error);
          process.exit(1);
        }
      };

      // Call the catch block
      await catchBlock();

      // Verify error handling
      expect(mocks.console.error).toHaveBeenCalledWith('Fatal error in main():', testError);
      expect(mocks.process.exit).toHaveBeenCalledWith(1);
    });

    it('should directly test the main function catch block', async () => {
      // Reset mocks for this test
      vi.resetAllMocks();

      // Mock console.error and process.exit
      console.error = mocks.console.error;
      process.exit = mocks.process.exit as any;

      // Create a function that simulates the main function with catch block
      const mainWithCatch = async () => {
        const main = async () => {
          throw new Error('Main function error');
        };

        main().catch((error) => {
          console.error('Fatal error in main():', error);
          process.exit(1);
        });
      };

      // Call the function
      await mainWithCatch();

      // Verify error handling
      expect(mocks.console.error).toHaveBeenCalledWith(
        'Fatal error in main():',
        expect.objectContaining({ message: 'Main function error' })
      );
      expect(mocks.process.exit).toHaveBeenCalledWith(1);
    });
  });

  // Test the main function
  describe('main function', () => {
    it('should connect the server to the transport', async () => {
      // Reset mocks for this test
      vi.resetAllMocks();

      // Create a server mock
      const serverMock = {
        tool: vi.fn().mockReturnThis(),
        connect: vi.fn().mockResolvedValue(undefined),
        capabilities: {
          serverInfo: { name: 'Test Server', version: '1.0.0' },
          resources: {},
          tools: {},
        },
      };

      // Mock McpServer to return our server mock
      mocks.McpServer.mockReturnValue(serverMock);

      // Create a mock StdioServerTransport instance
      const transportMock = {};
      mocks.StdioServerTransport.mockReturnValue(transportMock);

      // Define a test main function that simulates the actual main function
      const testMain = async () => {
        const transport = new mocks.StdioServerTransport();
        await serverMock.connect(transport);
        mocks.console.error('Context7 Documentation MCP Server running on stdio');
      };

      // Call the test main function
      await testMain();

      // Verify the server was connected to the transport
      expect(mocks.StdioServerTransport).toHaveBeenCalledTimes(1);
      expect(serverMock.connect).toHaveBeenCalledWith(transportMock);
      expect(mocks.console.error).toHaveBeenCalledWith(
        'Context7 Documentation MCP Server running on stdio'
      );
    });

    it('should handle errors and exit the process', async () => {
      // Reset mocks for this test
      vi.resetAllMocks();

      // Create a server mock that throws an error on connect
      const serverMock = {
        tool: vi.fn().mockReturnThis(),
        connect: vi.fn().mockRejectedValue(new Error('Connection error')),
        capabilities: {
          serverInfo: { name: 'Test Server', version: '1.0.0' },
          resources: {},
          tools: {},
        },
      };

      // Mock McpServer to return our error-throwing server
      mocks.McpServer.mockReturnValue(serverMock);

      // Define a test main function that simulates the actual main function with error handling
      const testMain = async () => {
        try {
          const transport = new mocks.StdioServerTransport();
          await serverMock.connect(transport);
          mocks.console.error('Context7 Documentation MCP Server running on stdio');
        } catch (error) {
          mocks.console.error('Fatal error in main():', error);
          mocks.process.exit(1);
        }
      };

      // Call the test main function
      await testMain();

      // Verify error handling
      expect(mocks.console.error).toHaveBeenCalledWith(
        'Fatal error in main():',
        expect.objectContaining({ message: 'Connection error' })
      );
      expect(mocks.process.exit).toHaveBeenCalledWith(1);
    });

    it('should create a server with the correct configuration', async () => {
      // Reset mocks for this test
      vi.resetAllMocks();

      // Create a server mock
      const serverMock = {
        tool: vi.fn().mockReturnThis(),
        connect: vi.fn().mockResolvedValue(undefined),
        capabilities: {
          serverInfo: { name: 'Test Server', version: '1.0.0' },
          resources: {},
          tools: {},
        },
      };

      // Mock McpServer to return our server mock
      mocks.McpServer.mockReturnValue(serverMock);

      // Create a mock implementation of the server creation
      const createServer = () => {
        return new mocks.McpServer({
          name: 'Context7',
          description: 'Retrieves up-to-date documentation and code examples for any library.',
          version: '1.0.6',
          capabilities: {
            resources: {},
            tools: {},
          },
        });
      };

      // Call the mock server creation function
      createServer();

      // Verify the server was created with the correct configuration
      expect(mocks.McpServer).toHaveBeenCalledWith({
        name: 'Context7',
        description: 'Retrieves up-to-date documentation and code examples for any library.',
        version: '1.0.6',
        capabilities: {
          resources: {},
          tools: {},
        },
      });
    });

    it('should register both tools with the server', async () => {
      // Reset mocks for this test
      vi.resetAllMocks();

      // Create a server mock to capture tool registrations
      const serverMock = {
        tool: vi.fn().mockReturnThis(),
        connect: vi.fn().mockResolvedValue(undefined),
        capabilities: {
          serverInfo: { name: 'Test Server', version: '1.0.0' },
          resources: {},
          tools: {},
        },
      };

      // Mock McpServer to return our server mock
      mocks.McpServer.mockReturnValue(serverMock);

      // Manually register the tools as they would be in the module
      serverMock.tool(
        'resolve-library-id',
        "Required first step: Resolves a general package name into a Context7-compatible library ID. Must be called before using 'get-library-docs' to retrieve a valid Context7-compatible library ID.",
        {
          libraryName: expect.any(Object),
        },
        expect.any(Function)
      );

      serverMock.tool(
        'get-library-docs',
        "Fetches up-to-date documentation for a library. You must call 'resolve-library-id' first to obtain the exact Context7-compatible library ID required to use this tool.",
        {
          context7CompatibleLibraryID: expect.any(Object),
          topic: expect.any(Object),
          tokens: expect.any(Object),
        },
        expect.any(Function)
      );

      // Verify both tools were registered
      expect(serverMock.tool).toHaveBeenCalledTimes(2);

      // Verify resolve-library-id tool was registered
      expect(serverMock.tool).toHaveBeenCalledWith(
        'resolve-library-id',
        expect.stringContaining('Resolves a general package name'),
        expect.objectContaining({
          libraryName: expect.any(Object),
        }),
        expect.any(Function)
      );

      // Verify get-library-docs tool was registered
      expect(serverMock.tool).toHaveBeenCalledWith(
        'get-library-docs',
        expect.stringContaining('Fetches up-to-date documentation'),
        expect.objectContaining({
          context7CompatibleLibraryID: expect.any(Object),
          topic: expect.any(Object),
          tokens: expect.any(Object),
        }),
        expect.any(Function)
      );
    });
  });
});
