/**
 * @fileoverview Utility functions for MCP tools.
 * @deprecated Use src/mcp/errors/handler.ts for error handling.
 */
import type { ToolResponse, Task, TaskSummary } from '../types/index.js';
import { ErrorCode } from '../../types/errors.js';
import { createErrorResponse as createMcpErrorResponseFromHandler } from '../errors/handler.js';

/**
 * Creates a success response with the specified data and message
 * @deprecated Use the error handler utilities instead
 */
export function createSuccessResponse<T>(data: T, message: string): ToolResponse<T> {
  return {
    success: true,
    message,
    data,
  };
}

/**
 * Creates an error response with the specified message and optional error details
 * @deprecated Use the error handler utilities instead
 */
export function createErrorResponse(message: string, error?: unknown): ToolResponse<null> {
  return {
    success: false,
    message,
    data: null,
    error: error ? String(error) : undefined,
  };
}

/**
 * Creates a formatted MCP tool response for success scenarios
 * @deprecated Use the error handler utilities instead
 */
export function createMcpSuccessResponse<T>(
  data: T,
  message: string
): { content: Array<{ type: string; text: string }> } {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(createSuccessResponse(data, message)),
      },
    ],
  };
}

/**
 * Creates a formatted MCP tool response for error scenarios
 * @deprecated Use handleError from src/mcp/errors/handler.js instead
 */
export function createMcpErrorResponse(
  message: string,
  error?: unknown
): {
  content: Array<{ type: string; text: string }>;
  isError: boolean;
} {
  return createMcpErrorResponseFromHandler(message, ErrorCode.UNKNOWN_ERROR, error);
}

/**
 * Calculates task summary statistics
 */
export function calculateTaskSummary(tasks: Task[]): TaskSummary {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => task.status === 'done').length;
  const pendingTasks = tasks.filter((task) => task.status === 'pending').length;
  const inProgressTasks = tasks.filter((task) => task.status === 'in-progress').length;

  const taskCompletionPercentage =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return {
    totalTasks,
    completedTasks,
    pendingTasks,
    inProgressTasks,
    taskCompletionPercentage,
  };
}
