/**
 * @fileoverview MCP-specific error classes for the AgentPM application.
 * Extends the base error classes from src/types/errors.ts with MCP-specific functionality.
 * These error classes are used to provide consistent error handling across MCP tools.
 */
import { MCPError, ErrorCode } from '../../types/errors.js';

/**
 * MCP validation error for parameter validation failures
 */
export class MCPValidationError extends MCPError {
  /**
   * Creates a new MCP validation error
   * @param message Error message
   * @param details Additional error details (e.g., validation errors)
   */
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.MCP_INVALID_PARAMETERS, details);
    this.name = 'MCPValidationError';
  }
}

/**
 * MCP not found error for resources that don't exist
 */
export class MCPNotFoundError extends MCPError {
  /**
   * Creates a new MCP not found error
   * @param message Error message
   * @param details Additional error details
   */
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.NOT_FOUND, details);
    this.name = 'MCPNotFoundError';
  }
}

/**
 * MCP operation error for async operation failures
 */
export class MCPOperationError extends MCPError {
  /**
   * Creates a new MCP operation error
   * @param message Error message
   * @param details Additional error details
   */
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.MCP_OPERATION_FAILED, details);
    this.name = 'MCPOperationError';
  }
}

/**
 * MCP permission error for unauthorized operations
 */
export class MCPPermissionError extends MCPError {
  /**
   * Creates a new MCP permission error
   * @param message Error message
   * @param details Additional error details
   */
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.OPERATION_NOT_PERMITTED, details);
    this.name = 'MCPPermissionError';
  }
}

/**
 * MCP tool not found error
 */
export class MCPToolNotFoundError extends MCPError {
  /**
   * Creates a new MCP tool not found error
   * @param message Error message
   * @param details Additional error details
   */
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.MCP_TOOL_NOT_FOUND, details);
    this.name = 'MCPToolNotFoundError';
  }
}

/**
 * MCP server error for internal server errors
 */
export class MCPServerError extends MCPError {
  /**
   * Creates a new MCP server error
   * @param message Error message
   * @param details Additional error details
   */
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.MCP_SERVER_ERROR, details);
    this.name = 'MCPServerError';
  }
}

/**
 * MCP session error for session-related issues
 */
export class MCPSessionError extends MCPError {
  /**
   * Creates a new MCP session error
   * @param message Error message
   * @param details Additional error details
   */
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.MCP_SESSION_EXPIRED, details);
    this.name = 'MCPSessionError';
  }
}

/**
 * MCP rate limit error
 */
export class MCPRateLimitError extends MCPError {
  /**
   * Creates a new MCP rate limit error
   * @param message Error message
   * @param details Additional error details
   */
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.MCP_TOO_MANY_OPERATIONS, details);
    this.name = 'MCPRateLimitError';
  }
}

// Export all error classes
export { MCPError, ErrorCode } from '../../types/errors.js';
