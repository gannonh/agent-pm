import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock objects
const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockClose = vi.fn().mockResolvedValue(undefined);
const mockServer = {
  connect: mockConnect,
  close: mockClose,
  capabilities: { serverInfo: { name: 'Test', version: '1.0.0' } },
};

// Mock dependencies before importing the module under test
vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn().mockImplementation(() => mockServer),
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({
    // Mock transport methods if needed
  })),
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Import the module under test after mocking dependencies
import { AgentPMMCPServer } from '../server.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { logger } from '../utils/logger.js';

describe('AgentPMMCPServer', () => {
  let server: AgentPMMCPServer;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new AgentPMMCPServer();
  });

  it('should initialize with correct properties', () => {
    expect(McpServer).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'AgentPM',
        version: '0.1.0',
        capabilities: expect.objectContaining({
          resources: expect.objectContaining({
            subscribe: true,
            listChanged: true,
          }),
          prompts: expect.objectContaining({
            listChanged: true,
          }),
        }),
      })
    );
  });

  it('should return the McpServer instance', () => {
    const mcpServer = server.getServer();
    expect(mcpServer).toBe(mockServer);
    expect(mcpServer.connect).toBe(mockConnect);
    expect(mcpServer.close).toBe(mockClose);
  });

  it('should start the server with transport', async () => {
    await server.start();

    expect(StdioServerTransport).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('AgentPM MCP Server starting...');
    expect(mockConnect).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('AgentPM MCP Server started');
  });

  it('should handle errors during start', async () => {
    const connectError = new Error('Connection error');
    mockConnect.mockRejectedValueOnce(connectError);

    await expect(server.start()).rejects.toThrow('Connection error');
    expect(logger.error).toHaveBeenCalledWith('Failed to start AgentPM MCP Server', connectError);
  });

  it('should stop the server and clean up resources', async () => {
    // First start the server to initialize transport
    await server.start();
    vi.clearAllMocks(); // Clear mocks after start

    await server.stop();

    expect(logger.info).toHaveBeenCalledWith('AgentPM MCP Server stopping...');
    expect(mockClose).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('AgentPM MCP Server stopped');
  });

  it('should handle errors during stop', async () => {
    // First start the server to initialize transport
    await server.start();

    const closeError = new Error('Close error');
    mockClose.mockRejectedValueOnce(closeError);

    await expect(server.stop()).rejects.toThrow('Close error');
    expect(logger.error).toHaveBeenCalledWith('Failed to stop AgentPM MCP Server', closeError);
  });

  it('should not attempt to close if transport is null', async () => {
    // Don't start the server, so transport remains null
    await server.stop();

    expect(logger.info).toHaveBeenCalledWith('AgentPM MCP Server stopping...');
    expect(mockClose).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('AgentPM MCP Server stopped');
  });
});
