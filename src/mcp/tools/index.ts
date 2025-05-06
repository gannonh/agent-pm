import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTaskTool } from './task.js';
import { registerTaskModifyTool } from './task-modify/index.js';
import { registerCreateProjectBriefTool } from './project/index.js';
import { registerDependenciesTool } from './dependencies/index.js';
import { registerGenerateTool } from './task-generate.js';
import { registerComplexityTool } from './complexity/index.js';
import { registerContext7Tools } from './context7/index.js';
import { logger } from '../utils/logger.js';

/**
 * Registers all MCP tools with the server
 */
export function registerTools(server: McpServer): void {
  logger.info('Registering MCP tools...');

  // Each tool registers itself with a description
  registerTaskTool(server); // Consolidated task query tool
  registerTaskModifyTool(server); // Consolidated task modification tool
  registerGenerateTool(server); // Task generation tool

  registerCreateProjectBriefTool(server); // Project brief creation tool

  // Task dependency management tools
  registerDependenciesTool(server); // Consolidated dependency management tool

  // Analysis tools
  registerComplexityTool(server); // Consolidated complexity analysis and reporting tool

  // Documentation tools
  registerContext7Tools(server); // Context7 documentation retrieval tools

  logger.info('MCP tools registered');
}
