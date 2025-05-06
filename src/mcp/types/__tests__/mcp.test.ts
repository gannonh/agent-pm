import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import {
  MCPToolDefinition,
  MCPToolContext,
  MCPToolResponse,
  MCPToolSuccessResponse,
  MCPToolErrorResponse,
  MCPAsyncOperation,
  MCPSession,
  MCPServerEvent,
} from '../../../types/mcp.js';

describe('MCP Types', () => {
  describe('MCPToolDefinition', () => {
    it('should create a valid tool definition', async () => {
      const mockExecute = vi.fn().mockResolvedValue({
        success: true,
        data: { result: 'success' },
      });

      const toolDefinition: MCPToolDefinition = {
        name: 'test-tool',
        description: 'A test tool',
        parameters: [
          {
            name: 'param1',
            type: 'string',
            description: 'A string parameter',
            required: true,
            schema: z.string(),
          },
          {
            name: 'param2',
            type: 'number',
            description: 'A number parameter',
            required: false,
            schema: z.number().optional(),
          },
        ],
        execute: mockExecute,
      };

      const mockContext: MCPToolContext = {
        sessionId: 'test-session',
        log: {
          debug: vi.fn(),
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        },
        config: {},
      };

      // Execute the tool
      const result = await toolDefinition.execute({ param1: 'test' }, mockContext);

      expect(mockExecute).toHaveBeenCalledWith({ param1: 'test' }, mockContext);
      expect(result).toEqual({
        success: true,
        data: { result: 'success' },
      });
    });
  });

  describe('MCPToolResponse', () => {
    it('should create a valid success response', () => {
      const successResponse: MCPToolSuccessResponse = {
        success: true,
        data: { result: 'success' },
      };

      // Type check
      const response: MCPToolResponse = successResponse;

      expect(response.success).toBe(true);
      expect(response).toEqual(successResponse);
    });

    it('should create a valid error response', () => {
      const errorResponse: MCPToolErrorResponse = {
        success: false,
        error: {
          message: 'An error occurred',
          code: 'ERROR_CODE',
        },
      };

      // Type check
      const response: MCPToolResponse = errorResponse;

      expect(response.success).toBe(false);
      expect(response).toEqual(errorResponse);
    });
  });

  describe('MCPAsyncOperation', () => {
    it('should create a valid async operation', () => {
      const operation: MCPAsyncOperation = {
        id: 'op-123',
        status: 'running',
        progress: 50,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(operation.id).toBe('op-123');
      expect(operation.status).toBe('running');
      expect(operation.progress).toBe(50);
    });

    it('should create a completed async operation with result', () => {
      const operation: MCPAsyncOperation = {
        id: 'op-123',
        status: 'completed',
        progress: 100,
        result: { data: 'result data' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(operation.status).toBe('completed');
      expect(operation.progress).toBe(100);
      expect(operation.result).toEqual({ data: 'result data' });
    });

    it('should create a failed async operation with error', () => {
      const operation: MCPAsyncOperation = {
        id: 'op-123',
        status: 'failed',
        progress: 75,
        error: {
          message: 'Operation failed',
          code: 'OPERATION_FAILED',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(operation.status).toBe('failed');
      expect(operation.error?.message).toBe('Operation failed');
      expect(operation.error?.code).toBe('OPERATION_FAILED');
    });
  });

  describe('MCPSession', () => {
    it('should create a valid session', () => {
      const session: MCPSession = {
        id: 'session-123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        context: {
          userId: 'user-123',
          projectId: 'project-123',
        },
        operations: {},
      };

      expect(session.id).toBe('session-123');
      expect(session.context.userId).toBe('user-123');
      expect(session.operations).toEqual({});
    });

    it('should create a session with operations', () => {
      const session: MCPSession = {
        id: 'session-123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        context: {},
        operations: {
          'op-123': {
            id: 'op-123',
            status: 'running',
            progress: 50,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      };

      expect(session.operations['op-123'].id).toBe('op-123');
      expect(session.operations['op-123'].status).toBe('running');
    });
  });

  describe('MCPServerEvent', () => {
    it('should create a valid server event', () => {
      const event: MCPServerEvent = {
        type: 'server-started',
        timestamp: new Date().toISOString(),
      };

      expect(event.type).toBe('server-started');
    });

    it('should create a tool execution event', () => {
      const event: MCPServerEvent = {
        type: 'tool-executed',
        timestamp: new Date().toISOString(),
        sessionId: 'session-123',
        toolName: 'test-tool',
        data: {
          args: { param1: 'value1' },
          result: { success: true, data: {} },
        },
      };

      expect(event.type).toBe('tool-executed');
      expect(event.sessionId).toBe('session-123');
      expect(event.toolName).toBe('test-tool');
    });

    it('should create an error event', () => {
      const event: MCPServerEvent = {
        type: 'error',
        timestamp: new Date().toISOString(),
        data: {
          message: 'An error occurred',
          stack: 'Error stack trace',
        },
      };

      expect(event.type).toBe('error');
      expect((event.data as { message: string }).message).toBe('An error occurred');
    });
  });
});
