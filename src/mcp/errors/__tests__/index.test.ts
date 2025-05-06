import { describe, it, expect } from 'vitest';
import {
  MCPError,
  ErrorCode,
  MCPValidationError,
  MCPNotFoundError,
  MCPOperationError,
  MCPPermissionError,
  MCPToolNotFoundError,
  MCPServerError,
  MCPSessionError,
  MCPRateLimitError,
} from '../index.js';

describe('MCP Error Classes', () => {
  describe('MCPValidationError', () => {
    it('should create a validation error with the correct properties', () => {
      const details = { field: ['Field is required'] };
      const error = new MCPValidationError('Invalid parameters', details);

      expect(error.message).toBe('Invalid parameters');
      expect(error.code).toBe(ErrorCode.MCP_INVALID_PARAMETERS);
      expect(error.name).toBe('MCPValidationError');
      expect(error.details).toEqual(details);
      expect(error instanceof MCPError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });

    it('should convert to JSON correctly', () => {
      const details = { field: ['Field is required'] };
      const error = new MCPValidationError('Invalid parameters', details);
      const json = error.toJSON();

      expect(json).toEqual({
        name: 'MCPValidationError',
        message: 'Invalid parameters',
        code: ErrorCode.MCP_INVALID_PARAMETERS,
        details,
      });
    });
  });

  describe('MCPNotFoundError', () => {
    it('should create a not found error with the correct properties', () => {
      const error = new MCPNotFoundError('Resource not found');

      expect(error.message).toBe('Resource not found');
      expect(error.code).toBe(ErrorCode.NOT_FOUND);
      expect(error.name).toBe('MCPNotFoundError');
      expect(error instanceof MCPError).toBe(true);
    });
  });

  describe('MCPOperationError', () => {
    it('should create an operation error with the correct properties', () => {
      const error = new MCPOperationError('Operation failed');

      expect(error.message).toBe('Operation failed');
      expect(error.code).toBe(ErrorCode.MCP_OPERATION_FAILED);
      expect(error.name).toBe('MCPOperationError');
      expect(error instanceof MCPError).toBe(true);
    });
  });

  describe('MCPPermissionError', () => {
    it('should create a permission error with the correct properties', () => {
      const error = new MCPPermissionError('Permission denied');

      expect(error.message).toBe('Permission denied');
      expect(error.code).toBe(ErrorCode.OPERATION_NOT_PERMITTED);
      expect(error.name).toBe('MCPPermissionError');
      expect(error instanceof MCPError).toBe(true);
    });
  });

  describe('MCPToolNotFoundError', () => {
    it('should create a tool not found error with the correct properties', () => {
      const error = new MCPToolNotFoundError('Tool not found');

      expect(error.message).toBe('Tool not found');
      expect(error.code).toBe(ErrorCode.MCP_TOOL_NOT_FOUND);
      expect(error.name).toBe('MCPToolNotFoundError');
      expect(error instanceof MCPError).toBe(true);
    });
  });

  describe('MCPServerError', () => {
    it('should create a server error with the correct properties', () => {
      const error = new MCPServerError('Internal server error');

      expect(error.message).toBe('Internal server error');
      expect(error.code).toBe(ErrorCode.MCP_SERVER_ERROR);
      expect(error.name).toBe('MCPServerError');
      expect(error instanceof MCPError).toBe(true);
    });
  });

  describe('MCPSessionError', () => {
    it('should create a session error with the correct properties', () => {
      const error = new MCPSessionError('Session expired');

      expect(error.message).toBe('Session expired');
      expect(error.code).toBe(ErrorCode.MCP_SESSION_EXPIRED);
      expect(error.name).toBe('MCPSessionError');
      expect(error instanceof MCPError).toBe(true);
    });
  });

  describe('MCPRateLimitError', () => {
    it('should create a rate limit error with the correct properties', () => {
      const error = new MCPRateLimitError('Too many requests');

      expect(error.message).toBe('Too many requests');
      expect(error.code).toBe(ErrorCode.MCP_TOO_MANY_OPERATIONS);
      expect(error.name).toBe('MCPRateLimitError');
      expect(error instanceof MCPError).toBe(true);
    });
  });
});
