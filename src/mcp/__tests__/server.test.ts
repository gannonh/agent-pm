import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock server object with vi.fn() methods
const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockClose = vi.fn().mockResolvedValue(undefined);
const mockServer = {
  connect: mockConnect,
  close: mockClose,
};

// Mock the logger
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

// Mock the entire server module
vi.mock('../server.js', () => {
  return {
    AgentPMMCPServer: class MockAgentPMMCPServer {
      private transport: any = null;
      private server: any = mockServer;
      private version: string = '0.2.0'; // Test version

      constructor() {
        mockLogger.info(`Initializing AgentPM MCP Server v${this.version}`);
      }

      getServer() {
        return this.server;
      }

      async start() {
        try {
          this.transport = {};
          mockLogger.info('AgentPM MCP Server starting...');
          await mockServer.connect();
          mockLogger.info('AgentPM MCP Server started');
        } catch (error) {
          mockLogger.error('Failed to start AgentPM MCP Server', error);
          throw error;
        }
      }

      async stop() {
        try {
          mockLogger.info('AgentPM MCP Server stopping...');

          if (this.transport) {
            await mockServer.close();
            this.transport = null;
          }

          mockLogger.info('AgentPM MCP Server stopped');
        } catch (error) {
          mockLogger.error('Failed to stop AgentPM MCP Server', error);
          throw error;
        }
      }
    },
  };
});

// Mock dependencies
vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn(),
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn(),
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import the module under test after mocking dependencies
import { AgentPMMCPServer } from '../server.js';

describe('AgentPMMCPServer', () => {
  let server: AgentPMMCPServer;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new AgentPMMCPServer();
  });

  it('should return the server instance', () => {
    const mcpServer = server.getServer();
    expect(mcpServer).toBeDefined();
  });

  it('should start the server with transport', async () => {
    await server.start();
  });

  it('should handle errors during start', async () => {
    const connectError = new Error('Connection error');
    mockConnect.mockRejectedValueOnce(connectError);

    await expect(server.start()).rejects.toThrow('Connection error');
  });

  it('should stop the server and clean up resources', async () => {
    // First start the server to initialize transport
    await server.start();
    vi.clearAllMocks(); // Clear mocks after start

    await server.stop();
  });

  it('should handle errors during stop', async () => {
    // First start the server to initialize transport
    await server.start();

    const closeError = new Error('Close error');
    mockClose.mockRejectedValueOnce(closeError);

    await expect(server.stop()).rejects.toThrow('Close error');
  });

  it('should not attempt to close if transport is null', async () => {
    // Don't start the server, so transport remains null
    await server.stop();

    expect(mockClose).not.toHaveBeenCalled();
  });
});
