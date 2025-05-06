/**
 * @fileoverview Session management tools for MCP server.
 * Provides tools for creating, retrieving, and managing sessions.
 */

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { sessionManager } from '../session/manager.js';
import { validateParams } from '../validation/index.js';
import { handleError, MCPErrorResponse } from '../errors/handler.js';

/**
 * Registers session management tools with the MCP server.
 * These tools provide functionality for creating, retrieving, and managing sessions.
 *
 * @param server - The MCP server instance to register the tools with
 */
export function registerSessionTools(server: McpServer): void {
  // Register the create session tool
  registerCreateSessionTool(server);

  // Register the get session tool
  registerGetSessionTool(server);

  // Register the update session tool
  registerUpdateSessionTool(server);

  // Register the destroy session tool
  registerDestroySessionTool(server);
}

/**
 * Registers the create_session tool with the MCP server.
 * This tool creates a new session with optional initial context.
 *
 * @param server - The MCP server instance to register the tool with
 */
function registerCreateSessionTool(server: McpServer): void {
  const createSessionSchema = z.object({
    initialContext: z
      .record(z.unknown())
      .optional()
      .describe('Initial context data for the session'),
    timeout: z
      .number()
      .positive()
      .optional()
      .describe('Session timeout in milliseconds (default: 1 hour)'),
  });

  type CreateSessionParams = z.infer<typeof createSessionSchema>;

  server.tool(
    'apm_create_session',
    'Create a new session with optional initial context',
    createSessionSchema.shape,
    async (
      params: CreateSessionParams
    ): Promise<{ content: Array<{ type: 'text'; text: string }> } | MCPErrorResponse> => {
      try {
        // Validate parameters
        const validatedParams = validateParams(params, createSessionSchema);
        const { initialContext, timeout } = validatedParams;

        // Create a new session
        const session = sessionManager.createSession({
          initialContext,
          timeout,
        });

        // Return the session ID and creation timestamp
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'Session created successfully',
                data: {
                  sessionId: session.id,
                  createdAt: session.createdAt,
                },
              }),
            },
          ],
        };
      } catch (error) {
        return handleError(error, { toolName: 'apm_create_session', params });
      }
    }
  );
}

/**
 * Registers the get_session tool with the MCP server.
 * This tool retrieves a session by ID.
 *
 * @param server - The MCP server instance to register the tool with
 */
function registerGetSessionTool(server: McpServer): void {
  const getSessionSchema = z.object({
    sessionId: z.string().min(1).describe('Session ID to retrieve'),
  });

  type GetSessionParams = z.infer<typeof getSessionSchema>;

  server.tool(
    'apm_get_session',
    'Get a session by ID',
    getSessionSchema.shape,
    async (
      params: GetSessionParams
    ): Promise<{ content: Array<{ type: 'text'; text: string }> } | MCPErrorResponse> => {
      try {
        // Validate parameters
        const validatedParams = validateParams(params, getSessionSchema);
        const { sessionId } = validatedParams;

        // Get the session
        const session = sessionManager.getSession(sessionId);

        // Return the session
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'Session retrieved successfully',
                data: {
                  session,
                },
              }),
            },
          ],
        };
      } catch (error) {
        return handleError(error, { toolName: 'apm_get_session', params });
      }
    }
  );
}

/**
 * Registers the update_session tool with the MCP server.
 * This tool updates a session's context data.
 *
 * @param server - The MCP server instance to register the tool with
 */
function registerUpdateSessionTool(server: McpServer): void {
  const updateSessionSchema = z.object({
    sessionId: z.string().min(1).describe('Session ID to update'),
    context: z.record(z.unknown()).describe('Context data to update'),
    merge: z
      .boolean()
      .optional()
      .default(true)
      .describe('Whether to merge with existing context (default: true)'),
  });

  type UpdateSessionParams = z.infer<typeof updateSessionSchema>;

  server.tool(
    'apm_update_session',
    "Update a session's context data",
    updateSessionSchema.shape,
    async (
      params: UpdateSessionParams
    ): Promise<{ content: Array<{ type: 'text'; text: string }> } | MCPErrorResponse> => {
      try {
        // Validate parameters
        const validatedParams = validateParams(params, updateSessionSchema);
        const { sessionId, context, merge } = validatedParams;

        // Update the session
        const session = sessionManager.updateSessionContext(sessionId, context, merge);

        // Return the updated session
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'Session updated successfully',
                data: {
                  sessionId: session.id,
                  updatedAt: session.updatedAt,
                },
              }),
            },
          ],
        };
      } catch (error) {
        return handleError(error, { toolName: 'apm_update_session', params });
      }
    }
  );
}

/**
 * Registers the destroy_session tool with the MCP server.
 * This tool destroys a session by ID.
 *
 * @param server - The MCP server instance to register the tool with
 */
function registerDestroySessionTool(server: McpServer): void {
  const destroySessionSchema = z.object({
    sessionId: z.string().min(1).describe('Session ID to destroy'),
  });

  type DestroySessionParams = z.infer<typeof destroySessionSchema>;

  server.tool(
    'apm_destroy_session',
    'Destroy a session by ID',
    destroySessionSchema.shape,
    async (
      params: DestroySessionParams
    ): Promise<{ content: Array<{ type: 'text'; text: string }> } | MCPErrorResponse> => {
      try {
        // Validate parameters
        const validatedParams = validateParams(params, destroySessionSchema);
        const { sessionId } = validatedParams;

        // Destroy the session
        const result = sessionManager.destroySession(sessionId);

        // Return the result
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: result
                  ? 'Session destroyed successfully'
                  : 'Session not found or already destroyed',
                data: {
                  sessionId,
                  destroyed: result,
                },
              }),
            },
          ],
        };
      } catch (error) {
        return handleError(error, { toolName: 'apm_destroy_session', params });
      }
    }
  );
}
