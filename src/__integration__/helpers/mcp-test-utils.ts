/**
 * @fileoverview Helper utilities for MCP tool integration tests
 */

import * as dotenv from 'dotenv';
import { PROJECT_ROOT } from '../../config.js';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Define types for the dynamically imported tool module
interface ToolModule {
  [key: string]: (server: MockServer) => { handler?: ToolHandler };
}

// Define the type for the tool handler function
type ToolHandler = (params: Record<string, unknown>) => Promise<unknown>;

// Define the mock server interface
interface MockServer {
  tool: (
    name: string,
    description: string,
    schema: Record<string, unknown>,
    handler: ToolHandler
  ) => { handler: ToolHandler };
}

/**
 * Sets up an integration test environment for a specific MCP tool
 * @param toolName Name of the tool being tested
 * @returns Test environment with project root and tool handler
 */
export async function setupIntegrationTest(toolName: string): Promise<{
  projectRoot: string;
  toolHandler: ToolHandler;
}> {
  // Use the PROJECT_ROOT from environment variables
  const projectRoot = PROJECT_ROOT || '/tmp/apm-test';

  // Import the tool module dynamically
  const toolModule = (await import(`../../../src/mcp/tools/${toolName}.js`)) as ToolModule;

  // Get the register function name based on the tool name
  const registerFunctionName = `register${toolName
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')}Tool`;

  // Create a mock server
  const mockServer: MockServer = {
    tool: (
      _name: string,
      _description: string,
      _schema: Record<string, unknown>,
      handler: ToolHandler
    ) => {
      return { handler };
    },
  };

  // Register the tool with the mock server
  const result = toolModule[registerFunctionName](mockServer);

  // Get the tool handler
  const defaultHandler: ToolHandler = () => Promise.resolve({});
  const toolHandler = result?.handler || mockServer.tool('', '', {}, defaultHandler).handler;

  return { projectRoot, toolHandler };
}
