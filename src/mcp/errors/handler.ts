/**
 * @fileoverview Central error handler for MCP tools.
 * Provides consistent error handling and formatting for MCP responses.
 */
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { MCPError, ErrorCode, MCPValidationError } from './index.js';
import { create_error_payload } from '../utils/response.js';

/**
 * MCP error response structure
 */
export interface MCPErrorResponse {
  content: Array<{ type: 'text'; text: string }>;
  isError: boolean;
  [key: string]: unknown;
}

/**
 * Error context for additional debugging information
 */
export interface ErrorContext {
  toolName?: string;
  params?: Record<string, unknown>;
  operation?: string;
  [key: string]: unknown;
}

/**
 * Handles an error and returns a formatted MCP error response
 * @param error The error to handle
 * @param context Additional context for debugging
 * @returns Formatted MCP error response
 */
export function handleError(error: unknown, context?: ErrorContext): MCPErrorResponse {
  // Default error message and code
  let message = 'An unexpected error occurred';
  let code = ErrorCode.UNKNOWN_ERROR;
  let details: unknown = undefined;

  // Extract error information based on error type
  if (error instanceof MCPError) {
    message = error.message;
    code = error.code;
    details = error.details;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  }

  // Log the error with context for debugging
  logError(error, context);

  // Return a formatted MCP error response
  return createErrorResponse(message, code, details);
}

/**
 * Handles a Zod validation error and returns a formatted MCP error response
 * @param error Zod validation error
 * @param context Additional context for debugging
 * @returns Formatted MCP error response
 */
export function handleValidationError(error: z.ZodError, context?: ErrorContext): MCPErrorResponse {
  // Format the validation error details
  const formattedErrors = formatZodError(error);

  // Create a validation error with formatted details
  const validationError = new MCPValidationError('Invalid parameters', formattedErrors);

  // Log the validation error with context
  logError(validationError, context);

  // Return a formatted MCP error response
  return createErrorResponse(validationError.message, validationError.code, formattedErrors);
}

/**
 * Creates a formatted MCP error response
 * @param message Error message
 * @param code Error code
 * @param details Additional error details
 * @returns Formatted MCP error response
 */
export function createErrorResponse(
  message: string,
  code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
  details?: unknown
): MCPErrorResponse {
  return create_error_payload(
    {
      error: {
        message,
        code,
        details,
      },
    },
    message,
    {
      metadata: {
        errorCode: code,
      },
    }
  );
}

/**
 * Formats a Zod validation error into a more readable format
 * @param error Zod validation error
 * @returns Formatted validation error
 */
export function formatZodError(error: z.ZodError): Record<string, string[]> {
  const formattedErrors: Record<string, string[]> = {};

  for (const issue of error.errors) {
    const path = issue.path.join('.');
    const key = path || '_';

    if (!formattedErrors[key]) {
      formattedErrors[key] = [];
    }

    formattedErrors[key].push(issue.message);
  }

  return formattedErrors;
}

/**
 * Logs an error with context for debugging
 * @param error The error to log
 * @param context Additional context for debugging
 */
export function logError(error: unknown, context?: ErrorContext): void {
  // Prepare error details for logging
  const errorDetails = {
    error:
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
            ...(error instanceof MCPError ? { code: error.code, details: error.details } : {}),
          }
        : error,
    context,
  };

  // Log the error with context
  logger.error('MCP error:', errorDetails);
}

/**
 * Wraps an async function with error handling
 * @param fn The async function to wrap
 * @param context Additional context for debugging
 * @returns A wrapped function that handles errors
 */
export function withErrorHandling<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  context?: ErrorContext
): (...args: Args) => Promise<T | MCPErrorResponse> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, { ...context, args });
      }
      return handleError(error, { ...context, args });
    }
  };
}
