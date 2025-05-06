import { describe, it, expect, beforeEach, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Create shared mocks using vi.hoisted
const mocks = vi.hoisted(() => ({
  searchLibraries: vi.fn(),
  fetchLibraryDocumentation: vi.fn(),
  formatSearchResults: vi.fn(),
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  handleError: vi.fn(),
}));

// Mock dependencies
vi.mock('../../../../context7/lib/api.js', () => ({
  searchLibraries: mocks.searchLibraries,
  fetchLibraryDocumentation: mocks.fetchLibraryDocumentation,
}));

vi.mock('../../../../context7/lib/utils.js', () => ({
  formatSearchResults: mocks.formatSearchResults,
}));

vi.mock('../../../utils/logger.js', () => ({
  logger: mocks.logger,
}));

vi.mock('../../../errors/handler.js', () => ({
  handleError: mocks.handleError,
}));

describe('Context7 Tools', () => {
  let serverMock: { tool: ReturnType<typeof vi.fn> };
  let registerContext7Tools: (server: McpServer) => void;

  beforeEach(async () => {
    // Reset all mocks
    vi.resetAllMocks();

    // Create a mock server
    serverMock = { tool: vi.fn() };

    // Import the module under test AFTER mocks are set up
    const module = await import('../index.js');
    registerContext7Tools = module.registerContext7Tools;
  });

  it('should register Context7 tools with the server', () => {
    // Call the function with the mock server
    registerContext7Tools(serverMock as unknown as McpServer);

    // Verify that the tool method was called twice (once for each tool)
    expect(serverMock.tool).toHaveBeenCalledTimes(2);

    // Verify the first call was for context7_library_id
    expect(serverMock.tool.mock.calls[0][0]).toBe('context7_library_id');

    // Verify the second call was for context7_library_docs
    expect(serverMock.tool.mock.calls[1][0]).toBe('context7_library_docs');
  });

  it('should handle successful library search', async () => {
    // Register the tools
    registerContext7Tools(serverMock as unknown as McpServer);

    // Mock successful search response
    const mockSearchResponse = {
      results: [
        {
          id: 'test/library',
          title: 'Test Library',
          description: 'A test library',
        },
      ],
    };
    mocks.searchLibraries.mockResolvedValue(mockSearchResponse);
    mocks.formatSearchResults.mockReturnValue('Formatted search results');

    // Extract the handler function from the first tool registration
    const handler = serverMock.tool.mock.calls[0][3] as (params: any) => Promise<any>;

    // Call the handler with test parameters
    const result = await handler({ libraryName: 'test' });

    // Verify the search was called with the correct parameters
    expect(mocks.searchLibraries).toHaveBeenCalledWith('test');

    // Verify the results were formatted
    expect(mocks.formatSearchResults).toHaveBeenCalledWith(mockSearchResponse);

    // Verify the response structure
    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: 'Available libraries and their Context7-compatible library IDs:\n\nFormatted search results',
        },
      ],
    });
  });

  it('should handle successful documentation retrieval', async () => {
    // Register the tools
    registerContext7Tools(serverMock as unknown as McpServer);

    // Mock successful documentation retrieval
    mocks.fetchLibraryDocumentation.mockResolvedValue('Test documentation content');

    // Extract the handler function from the second tool registration
    const handler = serverMock.tool.mock.calls[1][3] as (params: any) => Promise<any>;

    // Call the handler with test parameters
    const result = await handler({
      context7CompatibleLibraryID: 'test/library',
      tokens: 5000,
      topic: 'test-topic',
    });

    // Verify the documentation was fetched with the correct parameters
    expect(mocks.fetchLibraryDocumentation).toHaveBeenCalledWith('test/library', {
      tokens: 5000,
      topic: 'test-topic',
      folders: '',
    });

    // Verify the response structure
    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: 'Test documentation content',
        },
      ],
    });
  });

  it('should handle folders parameter in library ID', async () => {
    // Register the tools
    registerContext7Tools(serverMock as unknown as McpServer);

    // Mock successful documentation retrieval
    mocks.fetchLibraryDocumentation.mockResolvedValue('Test documentation content');

    // Extract the handler function from the second tool registration
    const handler = serverMock.tool.mock.calls[1][3] as (params: any) => Promise<any>;

    // Call the handler with test parameters including folders
    const result = await handler({
      context7CompatibleLibraryID: 'test/library?folders=docs,examples',
      tokens: 5000,
    });

    // Verify the documentation was fetched with the correct parameters
    expect(mocks.fetchLibraryDocumentation).toHaveBeenCalledWith('test/library', {
      tokens: 5000,
      topic: '',
      folders: 'docs,examples',
    });

    // Verify the response structure
    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: 'Test documentation content',
        },
      ],
    });
  });

  it('should handle failed library search', async () => {
    // Register the tools
    registerContext7Tools(serverMock as unknown as McpServer);

    // Mock failed search response
    mocks.searchLibraries.mockResolvedValue(null);

    // Extract the handler function from the first tool registration
    const handler = serverMock.tool.mock.calls[0][3] as (params: any) => Promise<any>;

    // Call the handler with test parameters
    const result = await handler({ libraryName: 'test' });

    // Verify the search was called with the correct parameters
    expect(mocks.searchLibraries).toHaveBeenCalledWith('test');

    // Verify the response structure
    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: 'Failed to retrieve library documentation data from Context7',
        },
      ],
    });
  });

  it('should handle empty search results', async () => {
    // Register the tools
    registerContext7Tools(serverMock as unknown as McpServer);

    // Mock empty search response
    mocks.searchLibraries.mockResolvedValue({ results: [] });

    // Extract the handler function from the first tool registration
    const handler = serverMock.tool.mock.calls[0][3] as (params: any) => Promise<any>;

    // Call the handler with test parameters
    const result = await handler({ libraryName: 'test' });

    // Verify the search was called with the correct parameters
    expect(mocks.searchLibraries).toHaveBeenCalledWith('test');

    // Verify the response structure
    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: 'No documentation libraries available',
        },
      ],
    });
  });

  it('should handle failed documentation retrieval', async () => {
    // Register the tools
    registerContext7Tools(serverMock as unknown as McpServer);

    // Mock failed documentation retrieval
    mocks.fetchLibraryDocumentation.mockResolvedValue(null);

    // Extract the handler function from the second tool registration
    const handler = serverMock.tool.mock.calls[1][3] as (params: any) => Promise<any>;

    // Call the handler with test parameters
    const result = await handler({
      context7CompatibleLibraryID: 'test/library',
      tokens: 5000,
    });

    // Verify the documentation was fetched with the correct parameters
    expect(mocks.fetchLibraryDocumentation).toHaveBeenCalledWith('test/library', {
      tokens: 5000,
      topic: '',
      folders: '',
    });

    // Verify the response structure
    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: "Documentation not found or not finalized for this library. This might have happened because you used an invalid Context7-compatible library ID. To get a valid Context7-compatible library ID, use the 'context7_library_id' with the package name you wish to retrieve documentation for.",
        },
      ],
    });
  });

  it('should handle errors during library search', async () => {
    // Register the tools
    registerContext7Tools(serverMock as unknown as McpServer);

    // Mock error during search
    const error = new Error('Test error');
    mocks.searchLibraries.mockRejectedValue(error);
    mocks.handleError.mockReturnValue({
      content: [{ type: 'text', text: 'Error occurred' }],
      isError: true,
    });

    // Extract the handler function from the first tool registration
    const handler = serverMock.tool.mock.calls[0][3] as (params: any) => Promise<any>;

    // Call the handler with test parameters
    const result = await handler({ libraryName: 'test' });

    // Verify the error was handled
    expect(mocks.handleError).toHaveBeenCalledWith(error, {
      toolName: 'context7_library_id',
      params: { libraryName: 'test' },
    });

    // Verify the response structure
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Error occurred' }],
      isError: true,
    });
  });

  it('should handle errors during documentation retrieval', async () => {
    // Register the tools
    registerContext7Tools(serverMock as unknown as McpServer);

    // Mock error during documentation retrieval
    const error = new Error('Test error');
    mocks.fetchLibraryDocumentation.mockRejectedValue(error);
    mocks.handleError.mockReturnValue({
      content: [{ type: 'text', text: 'Error occurred' }],
      isError: true,
    });

    // Extract the handler function from the second tool registration
    const handler = serverMock.tool.mock.calls[1][3] as (params: any) => Promise<any>;

    // Call the handler with test parameters
    const result = await handler({
      context7CompatibleLibraryID: 'test/library',
      tokens: 5000,
    });

    // Verify the error was handled
    expect(mocks.handleError).toHaveBeenCalledWith(error, {
      toolName: 'context7_library_docs',
      params: {
        context7CompatibleLibraryID: 'test/library',
        tokens: 5000,
      },
    });

    // Verify the response structure
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Error occurred' }],
      isError: true,
    });
  });
});
