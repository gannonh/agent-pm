import { ResourceTemplate, type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from '../utils/logger.js';

/**
 * Registers all MCP resources with the server
 */
export function registerResources(server: McpServer): void {
  logger.info('Registering MCP resources...');

  // Register greeting resource
  registerGreetingResource(server);

  logger.info('MCP resources registered');
}

/**
 * Registers the greeting resource
 */
function registerGreetingResource(server: McpServer): void {
  server.resource(
    'greeting',
    new ResourceTemplate('greeting://{name}', { list: undefined }),
    async (uri, { name }) => ({
      contents: [
        {
          uri: uri.href,
          text: `Hello, ${name}!`,
        },
      ],
    })
  );
}
