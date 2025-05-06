import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { logger } from './utils/logger.js';

/**
 * AgentPM MCP Server class
 */
export class AgentPMMCPServer {
  private transport: StdioServerTransport | null = null;
  private server: McpServer;

  /**
   * Creates a new AgentPM MCP Server
   */
  constructor() {
    this.server = new McpServer({
      name: 'AgentPM',
      version: '0.1.0',
      capabilities: {
        resources: {
          subscribe: true,
          listChanged: true,
        },
        prompts: {
          listChanged: true,
        },
      },
    });
  }

  /**
   * Gets the McpServer instance
   */
  getServer(): McpServer {
    return this.server;
  }

  /**
   * Starts the server with the specified transport
   */
  async start(): Promise<void> {
    try {
      // Initialize transport
      this.transport = new StdioServerTransport();

      logger.info('AgentPM MCP Server starting...');
      await this.server.connect(this.transport);
      logger.info('AgentPM MCP Server started');
    } catch (error) {
      logger.error('Failed to start AgentPM MCP Server', error);
      throw error;
    }
  }

  /**
   * Stops the server and cleans up resources
   */
  async stop(): Promise<void> {
    try {
      logger.info('AgentPM MCP Server stopping...');

      // Clean up resources
      if (this.transport) {
        await this.server.close();
        this.transport = null;
      }

      logger.info('AgentPM MCP Server stopped');
    } catch (error) {
      logger.error('Failed to stop AgentPM MCP Server', error);
      throw error;
    }
  }
}
