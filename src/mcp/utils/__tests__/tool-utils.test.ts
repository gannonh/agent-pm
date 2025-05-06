import { describe, it, expect } from 'vitest';
import {
  createSuccessResponse,
  createErrorResponse,
  createMcpSuccessResponse,
  createMcpErrorResponse,
  calculateTaskSummary,
} from '../tool-utils.js';

describe('tool-utils', () => {
  describe('createSuccessResponse', () => {
    it('should create a properly formatted success response', () => {
      const data = { id: '1', name: 'Test' };
      const message = 'Operation successful';

      const result = createSuccessResponse(data, message);

      expect(result).toEqual({
        success: true,
        message: 'Operation successful',
        data: { id: '1', name: 'Test' },
      });
    });

    it('should work with primitive data types', () => {
      const result = createSuccessResponse('string data', 'Success');

      expect(result).toEqual({
        success: true,
        message: 'Success',
        data: 'string data',
      });
    });

    it('should work with array data', () => {
      const data = [1, 2, 3];
      const result = createSuccessResponse(data, 'Success');

      expect(result).toEqual({
        success: true,
        message: 'Success',
        data: [1, 2, 3],
      });
    });
  });

  describe('createErrorResponse', () => {
    it('should create a properly formatted error response', () => {
      const message = 'Operation failed';
      const error = new Error('Something went wrong');

      const result = createErrorResponse(message, error);

      expect(result).toEqual({
        success: false,
        message: 'Operation failed',
        data: null,
        error: 'Error: Something went wrong',
      });
    });

    it('should handle error without details', () => {
      const result = createErrorResponse('Operation failed');

      expect(result).toEqual({
        success: false,
        message: 'Operation failed',
        data: null,
        error: undefined,
      });
    });

    it('should convert non-Error objects to strings', () => {
      const result = createErrorResponse('Operation failed', { code: 404 });

      expect(result).toEqual({
        success: false,
        message: 'Operation failed',
        data: null,
        error: '[object Object]', // Default string conversion
      });
    });
  });

  describe('createMcpSuccessResponse', () => {
    it('should create a properly formatted MCP success response', () => {
      const data = { id: '1', name: 'Test' };
      const message = 'Operation successful';

      const result = createMcpSuccessResponse(data, message);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Operation successful',
              data: { id: '1', name: 'Test' },
            }),
          },
        ],
      });
    });
  });

  describe('createMcpErrorResponse', () => {
    it('should create a properly formatted MCP error response', () => {
      const message = 'Operation failed';
      const error = new Error('Something went wrong');

      const result = createMcpErrorResponse(message, error);

      // Check the structure without checking the exact content
      expect(result).toHaveProperty('content');
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]).toHaveProperty('text');
      expect(result).toHaveProperty('isError', true);

      // Parse the JSON to check the content
      const parsedContent = JSON.parse(result.content[0].text);
      expect(parsedContent).toHaveProperty('success', false);
      expect(parsedContent).toHaveProperty('data');
      expect(parsedContent.data).toHaveProperty('error');
      expect(parsedContent.data.error).toHaveProperty('message', 'Operation failed');
      expect(parsedContent.data.error).toHaveProperty('code');
    });
  });

  describe('calculateTaskSummary', () => {
    it('should calculate correct summary for mixed status tasks', () => {
      const tasks = [
        { id: '1', title: 'Task 1', status: 'done' },
        { id: '2', title: 'Task 2', status: 'pending' },
        { id: '3', title: 'Task 3', status: 'in-progress' },
        { id: '4', title: 'Task 4', status: 'done' },
      ];

      const result = calculateTaskSummary(tasks);

      expect(result).toEqual({
        totalTasks: 4,
        completedTasks: 2,
        pendingTasks: 1,
        inProgressTasks: 1,
        taskCompletionPercentage: 50, // 2/4 * 100 = 50%
      });
    });

    it('should handle empty task list', () => {
      const result = calculateTaskSummary([]);

      expect(result).toEqual({
        totalTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        inProgressTasks: 0,
        taskCompletionPercentage: 0,
      });
    });

    it('should handle all completed tasks', () => {
      const tasks = [
        { id: '1', title: 'Task 1', status: 'done' },
        { id: '2', title: 'Task 2', status: 'done' },
      ];

      const result = calculateTaskSummary(tasks);

      expect(result.taskCompletionPercentage).toBe(100);
    });

    it('should handle all pending tasks', () => {
      const tasks = [
        { id: '1', title: 'Task 1', status: 'pending' },
        { id: '2', title: 'Task 2', status: 'pending' },
      ];

      const result = calculateTaskSummary(tasks);

      expect(result.taskCompletionPercentage).toBe(0);
    });

    it('should handle custom status values', () => {
      const tasks = [
        { id: '1', title: 'Task 1', status: 'done' },
        { id: '2', title: 'Task 2', status: 'pending' },
        { id: '3', title: 'Task 3', status: 'in-progress' },
        { id: '4', title: 'Task 4', status: 'cancelled' }, // Custom status
        { id: '5', title: 'Task 5', status: 'deferred' }, // Custom status
      ];

      const result = calculateTaskSummary(tasks);

      expect(result).toEqual({
        totalTasks: 5,
        completedTasks: 1,
        pendingTasks: 1,
        inProgressTasks: 1,
        taskCompletionPercentage: 20, // 1/5 * 100 = 20%
      });
    });
  });
});
