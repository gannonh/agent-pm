import { describe, it, expect } from 'vitest';
import {
  ErrorCode,
  AppError,
  ValidationError,
  NotFoundError,
  FileSystemError,
  TaskError,
  AIError,
  MCPError,
} from '../../../types/errors.js';

describe('Error Types', () => {
  describe('AppError', () => {
    it('should create a base error with code and message', () => {
      const error = new AppError('An error occurred', ErrorCode.UNKNOWN_ERROR);

      expect(error.message).toBe('An error occurred');
      expect(error.code).toBe(ErrorCode.UNKNOWN_ERROR);
      expect(error.name).toBe('AppError');
      expect(error instanceof Error).toBe(true);
    });

    it('should include optional details', () => {
      const details = { param: 'value' };
      const error = new AppError('An error occurred', ErrorCode.UNKNOWN_ERROR, details);

      expect(error.details).toEqual(details);
    });

    it('should convert to JSON', () => {
      const details = { param: 'value' };
      const error = new AppError('An error occurred', ErrorCode.UNKNOWN_ERROR, details);
      const json = error.toJSON();

      expect(json).toEqual({
        name: 'AppError',
        message: 'An error occurred',
        code: ErrorCode.UNKNOWN_ERROR,
        details: details,
      });
    });
  });

  describe('ValidationError', () => {
    it('should create a validation error', () => {
      const error = new ValidationError('Validation failed');

      expect(error.message).toBe('Validation failed');
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.name).toBe('ValidationError');
      expect(error instanceof AppError).toBe(true);
      expect(error instanceof ValidationError).toBe(true);
    });

    it('should include validation details', () => {
      const details = { field: 'username', error: 'Required' };
      const error = new ValidationError('Validation failed', details);

      expect(error.details).toEqual(details);
    });
  });

  describe('NotFoundError', () => {
    it('should create a not found error', () => {
      const error = new NotFoundError('Resource not found');

      expect(error.message).toBe('Resource not found');
      expect(error.code).toBe(ErrorCode.NOT_FOUND);
      expect(error.name).toBe('NotFoundError');
      expect(error instanceof AppError).toBe(true);
      expect(error instanceof NotFoundError).toBe(true);
    });
  });

  describe('FileSystemError', () => {
    it('should create a file system error', () => {
      const error = new FileSystemError('File not found', ErrorCode.FILE_NOT_FOUND);

      expect(error.message).toBe('File not found');
      expect(error.code).toBe(ErrorCode.FILE_NOT_FOUND);
      expect(error.name).toBe('FileSystemError');
      expect(error instanceof AppError).toBe(true);
      expect(error instanceof FileSystemError).toBe(true);
    });
  });

  describe('TaskError', () => {
    it('should create a task error', () => {
      const error = new TaskError('Task not found', ErrorCode.TASK_NOT_FOUND);

      expect(error.message).toBe('Task not found');
      expect(error.code).toBe(ErrorCode.TASK_NOT_FOUND);
      expect(error.name).toBe('TaskError');
      expect(error instanceof AppError).toBe(true);
      expect(error instanceof TaskError).toBe(true);
    });
  });

  describe('AIError', () => {
    it('should create an AI error', () => {
      const error = new AIError('API error', ErrorCode.AI_API_ERROR);

      expect(error.message).toBe('API error');
      expect(error.code).toBe(ErrorCode.AI_API_ERROR);
      expect(error.name).toBe('AIError');
      expect(error instanceof AppError).toBe(true);
      expect(error instanceof AIError).toBe(true);
    });
  });

  describe('MCPError', () => {
    it('should create an MCP error', () => {
      const error = new MCPError('Tool not found', ErrorCode.MCP_TOOL_NOT_FOUND);

      expect(error.message).toBe('Tool not found');
      expect(error.code).toBe(ErrorCode.MCP_TOOL_NOT_FOUND);
      expect(error.name).toBe('MCPError');
      expect(error instanceof AppError).toBe(true);
      expect(error instanceof MCPError).toBe(true);
    });
  });
});
