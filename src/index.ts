#!/usr/bin/env node

import { registerTools } from './mcp/tools/index.js';
import { registerResources } from './mcp/resources/index.js';
import { registerPrompts } from './mcp/prompts/index.js';
import { AgentPMMCPServer } from './mcp/server.js';
import { logger } from './mcp/utils/logger.js';

// Create the MCP server
const server = new AgentPMMCPServer();

// Register all tools, resources, and prompts
registerTools(server.getServer());
registerResources(server.getServer());
registerPrompts(server.getServer());

// Start the server
try {
  await server.start();
} catch (error) {
  logger.error('Failed to start the MCP server', error);
  process.exit(1);
}
