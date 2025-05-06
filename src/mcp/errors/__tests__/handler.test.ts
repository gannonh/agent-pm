import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  handleError,
  handleValidationError,
  createErrorResponse,
  formatZodError,
  logError,
  withErrorHandling,
} from '../handler.js';
import { MCPValidationError, MCPError, ErrorCode } from '../index.js';

// Mock the logger
vi.mock('../../utils/logger.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

// Import the mocked logger
import { logger } from '../../utils/logger.js';

describe('Error Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleError', () => {
    it('should handle MCPError correctly', () => {
      const error = new MCPValidationError('Invalid parameters', { field: 'Required' });
      const context = { toolName: 'test-tool' };
      const response = handleError(error, context);

      expect(response.isError).toBe(true);
      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe('text');

      const parsedContent = JSON.parse(response.content[0].text);
      expect(parsedContent.success).toBe(false);
      expect(parsedContent.data.error.message).toBe('Invalid parameters');
      expect(parsedContent.data.error.code).toBe(ErrorCode.MCP_INVALID_PARAMETERS);
      expect(parsedContent.data.error.details).toEqual({ field: 'Required' });

      expect(logger.error).toHaveBeenCalledWith(
        'MCP error:',
        expect.objectContaining({
          error: expect.objectContaining({
            name: 'MCPValidationError',
            message: 'Invalid parameters',
          }),
          context,
        })
      );
    });

    it('should handle standard Error correctly', () => {
      const error = new Error('Something went wrong');
      const response = handleError(error);

      expect(response.isError).toBe(true);
      const parsedContent = JSON.parse(response.content[0].text);
      expect(parsedContent.data.error.message).toBe('Something went wrong');
      expect(parsedContent.data.error.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });

    it('should handle string error correctly', () => {
      const error = 'String error message';
      const response = handleError(error);

      expect(response.isError).toBe(true);
      const parsedContent = JSON.parse(response.content[0].text);
      expect(parsedContent.data.error.message).toBe('String error message');
    });

    it('should handle unknown error types correctly', () => {
      const error = { custom: 'error' };
      const response = handleError(error);

      expect(response.isError).toBe(true);
      const parsedContent = JSON.parse(response.content[0].text);
      expect(parsedContent.data.error.message).toBe('An unexpected error occurred');
    });
  });

  describe('handleValidationError', () => {
    it('should format Zod validation errors correctly', () => {
      const schema = z.object({
        name: z.string().min(1, 'Name is required'),
        age: z.number().min(18, 'Must be at least 18'),
      });

      let zodError: z.ZodError;
      try {
        schema.parse({ name: '', age: 16 });
      } catch (error) {
        zodError = error as z.ZodError;
        const response = handleValidationError(zodError);

        expect(response.isError).toBe(true);
        const parsedContent = JSON.parse(response.content[0].text);
        expect(parsedContent.data.error.message).toBe('Invalid parameters');
        expect(parsedContent.data.error.code).toBe(ErrorCode.MCP_INVALID_PARAMETERS);
        expect(parsedContent.data.error.details).toEqual({
          name: ['Name is required'],
          age: ['Must be at least 18'],
        });

        expect(logger.error).toHaveBeenCalled();
      }
    });
  });

  describe('createErrorResponse', () => {
    it('should create a properly formatted error response', () => {
      const response = createErrorResponse('Error message', ErrorCode.NOT_FOUND, {
        id: 'not-found',
      });

      expect(response.isError).toBe(true);
      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe('text');

      const parsedContent = JSON.parse(response.content[0].text);
      expect(parsedContent.success).toBe(false);
      expect(parsedContent.data.error.message).toBe('Error message');
      expect(parsedContent.data.error.code).toBe(ErrorCode.NOT_FOUND);
      expect(parsedContent.data.error.details).toEqual({ id: 'not-found' });
    });

    it('should use default error code if not provided', () => {
      const response = createErrorResponse('Error message');

      const parsedContent = JSON.parse(response.content[0].text);
      expect(parsedContent.data.error.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });
  });

  describe('formatZodError', () => {
    it('should format Zod errors into a readable structure', () => {
      const schema = z.object({
        name: z.string().min(1, 'Name is required'),
        email: z.string().email('Invalid email'),
        profile: z.object({
          bio: z.string().min(10, 'Bio must be at least 10 characters'),
        }),
      });

      try {
        schema.parse({ name: '', email: 'not-an-email', profile: { bio: 'Short' } });
      } catch (error) {
        const zodError = error as z.ZodError;
        const formatted = formatZodError(zodError);

        expect(formatted).toEqual({
          name: ['Name is required'],
          email: ['Invalid email'],
          'profile.bio': ['Bio must be at least 10 characters'],
        });
      }
    });

    it('should handle errors without paths', () => {
      const schema = z.string().refine(() => false, { message: 'Invalid value' });

      try {
        schema.parse('test');
      } catch (error) {
        const zodError = error as z.ZodError;
        const formatted = formatZodError(zodError);

        expect(formatted).toEqual({
          _: ['Invalid value'],
        });
      }
    });
  });

  describe('logError', () => {
    it('should log errors with context', () => {
      const error = new MCPError('Test error', ErrorCode.MCP_SERVER_ERROR);
      const context = { toolName: 'test-tool', params: { id: '123' } };

      logError(error, context);

      expect(logger.error).toHaveBeenCalledWith(
        'MCP error:',
        expect.objectContaining({
          error: expect.objectContaining({
            name: 'MCPError',
            message: 'Test error',
            code: ErrorCode.MCP_SERVER_ERROR,
          }),
          context,
        })
      );
    });

    it('should handle non-Error objects', () => {
      const error = { message: 'Custom error' };
      logError(error);

      expect(logger.error).toHaveBeenCalledWith(
        'MCP error:',
        expect.objectContaining({
          error,
        })
      );
    });
  });

  describe('withErrorHandling', () => {
    it('should pass through successful results', async () => {
      const fn = async () => 'success';
      const wrapped = withErrorHandling(fn);
      const result = await wrapped();

      expect(result).toBe('success');
    });

    it('should handle errors thrown by the wrapped function', async () => {
      const fn = async () => {
        throw new Error('Test error');
      };
      const wrapped = withErrorHandling(fn);
      const result = await wrapped();

      expect(result).toHaveProperty('isError', true);
      const parsedContent = JSON.parse(
        (result as { content: Array<{ text: string }> }).content[0].text
      );
      expect(parsedContent.data.error.message).toBe('Test error');
    });

    it('should handle Zod validation errors specially', async () => {
      const fn = async () => {
        const schema = z.object({ name: z.string().min(1) });
        schema.parse({ name: '' });
        return 'success';
      };
      const wrapped = withErrorHandling(fn);
      const result = await wrapped();

      expect(result).toHaveProperty('isError', true);
      const parsedContent = JSON.parse(
        (result as { content: Array<{ text: string }> }).content[0].text
      );
      expect(parsedContent.data.error.message).toBe('Invalid parameters');
      expect(parsedContent.data.error.code).toBe(ErrorCode.MCP_INVALID_PARAMETERS);
    });

    it('should include args in error context', async () => {
      const fn = async (_arg1: string, _arg2: number) => {
        throw new Error('Test error');
      };
      const wrapped = withErrorHandling(fn);
      await wrapped('test', 123);

      expect(logger.error).toHaveBeenCalledWith(
        'MCP error:',
        expect.objectContaining({
          context: expect.objectContaining({
            args: ['test', 123],
          }),
        })
      );
    });
  });
});
