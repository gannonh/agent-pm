import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => {
  const mockResource = vi.fn();
  return {
    McpServer: vi.fn().mockImplementation(() => ({
      resource: mockResource,
    })),
    ResourceTemplate: vi.fn().mockImplementation(() => ({})),
  };
});

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Import the module under test
import * as resourcesModule from '../index.js';

// Create a modified version of registerResources that accepts our mock server
const registerResources = (
  mockServer: Partial<McpServerType> & { resource: ReturnType<typeof vi.fn> }
) => {
  // Cast the mock server to McpServerType to satisfy the function signature
  return resourcesModule.registerResources(mockServer as unknown as McpServerType);
};
// Import the type for type checking
import type { McpServer as McpServerType } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from '../../utils/logger.js';

describe('registerResources', () => {
  // Define a mock server that satisfies the minimum requirements for the tests
  let mockServer: Partial<McpServerType> & { resource: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    // Create a mock server with the necessary properties
    mockServer = {
      resource: vi.fn(),
      // Add other required properties
      _registeredResources: {},
      _registeredResourceTemplates: {},
      _registeredTools: {},
      _registeredPrompts: {},
    } as Partial<McpServerType> & { resource: ReturnType<typeof vi.fn> };
  });

  it('should register all resources with the server', () => {
    registerResources(mockServer);

    expect(logger.info).toHaveBeenCalledWith('Registering MCP resources...');
    expect(mockServer.resource).toHaveBeenCalledWith(
      'greeting',
      expect.any(Object),
      expect.any(Function)
    );
    expect(ResourceTemplate).toHaveBeenCalledWith('greeting://{name}', { list: undefined });
    expect(logger.info).toHaveBeenCalledWith('MCP resources registered');
  });

  it('should handle greeting resource requests correctly', async () => {
    // First register the resources
    registerResources(mockServer);

    // Extract the handler function that was passed to resource()
    const handlerFn = mockServer.resource.mock.calls[0][2];

    // Create a mock URI
    const mockUri = { href: 'greeting://John' };

    // Call the handler function
    const result = await handlerFn(mockUri, { name: 'John' });

    // Verify the result
    expect(result).toEqual({
      contents: [
        {
          uri: 'greeting://John',
          text: 'Hello, John!',
        },
      ],
    });
  });
});
