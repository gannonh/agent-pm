/**
 * Error codes for the application
 */
export enum ErrorCode {
  // General errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  INVALID_OPERATION = 'INVALID_OPERATION',
  OPERATION_NOT_PERMITTED = 'OPERATION_NOT_PERMITTED',

  // File system errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_ALREADY_EXISTS = 'FILE_ALREADY_EXISTS',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  FILE_DELETE_ERROR = 'FILE_DELETE_ERROR',
  FILE_COPY_ERROR = 'FILE_COPY_ERROR',
  FILE_MOVE_ERROR = 'FILE_MOVE_ERROR',
  DIRECTORY_READ_ERROR = 'DIRECTORY_READ_ERROR',
  DIRECTORY_CREATE_ERROR = 'DIRECTORY_CREATE_ERROR',
  BACKUP_ERROR = 'BACKUP_ERROR',
  RESTORE_ERROR = 'RESTORE_ERROR',
  LOCK_ERROR = 'LOCK_ERROR',
  LOCK_TIMEOUT = 'LOCK_TIMEOUT',
  INVALID_FORMAT = 'INVALID_FORMAT',
  INVALID_ARGUMENT = 'INVALID_ARGUMENT',
  PARSING_ERROR = 'PARSING_ERROR',

  // Task errors
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  TASK_ALREADY_EXISTS = 'TASK_ALREADY_EXISTS',
  SUBTASK_NOT_FOUND = 'SUBTASK_NOT_FOUND',
  CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY',
  INVALID_DEPENDENCY = 'INVALID_DEPENDENCY',
  INVALID_STATUS_TRANSITION = 'INVALID_STATUS_TRANSITION',

  // Transaction errors
  TRANSACTION_IN_PROGRESS = 'TRANSACTION_IN_PROGRESS',
  NO_TRANSACTION = 'NO_TRANSACTION',

  // AI errors
  AI_API_ERROR = 'AI_API_ERROR',
  AI_RATE_LIMIT = 'AI_RATE_LIMIT',
  AI_CONTEXT_TOO_LARGE = 'AI_CONTEXT_TOO_LARGE',
  AI_INVALID_RESPONSE = 'AI_INVALID_RESPONSE',

  // External API errors
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',

  // MCP errors
  MCP_SERVER_ERROR = 'MCP_SERVER_ERROR',
  MCP_TOOL_NOT_FOUND = 'MCP_TOOL_NOT_FOUND',
  MCP_INVALID_PARAMETERS = 'MCP_INVALID_PARAMETERS',
  MCP_SESSION_EXPIRED = 'MCP_SESSION_EXPIRED',
  MCP_OPERATION_NOT_FOUND = 'MCP_OPERATION_NOT_FOUND',
  MCP_OPERATION_CANCELLED = 'MCP_OPERATION_CANCELLED',
  MCP_OPERATION_FAILED = 'MCP_OPERATION_FAILED',
  MCP_TOO_MANY_OPERATIONS = 'MCP_TOO_MANY_OPERATIONS',
}

/**
 * Base application error class
 */
export class AppError extends Error {
  code: ErrorCode;
  details?: unknown;

  constructor(message: string, code: ErrorCode, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
    };
  }
}

/**
 * Validation error
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.VALIDATION_ERROR, details);
    this.name = 'ValidationError';
  }
}

/**
 * Not found error
 */
export class NotFoundError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.NOT_FOUND, details);
    this.name = 'NotFoundError';
  }
}

/**
 * File system error
 */
export class FileSystemError extends AppError {
  constructor(message: string, code: ErrorCode, details?: unknown) {
    super(message, code, details);
    this.name = 'FileSystemError';
  }
}

/**
 * Task error
 */
export class TaskError extends AppError {
  constructor(message: string, code: ErrorCode, details?: unknown) {
    super(message, code, details);
    this.name = 'TaskError';
  }
}

/**
 * AI error
 */
export class AIError extends AppError {
  constructor(message: string, code: ErrorCode, details?: unknown) {
    super(message, code, details);
    this.name = 'AIError';
  }
}

/**
 * MCP error
 */
export class MCPError extends AppError {
  constructor(message: string, code: ErrorCode, details?: unknown) {
    super(message, code, details);
    this.name = 'MCPError';
  }
}
