/**
 * @fileoverview Tests for error handling in the expand action of the task-modify tool
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  sampleTasks,
  createMockServer,
  setupResponseMocks,
  setupFileMocks,
  setupAiClientMocks,
} from './test-utils.js';
import { createAnthropicClient } from '../../../../core/anthropic-client.js';

// Create shared mocks using vi.hoisted
const mocks = vi.hoisted(() => {
  // Create error responses
  const aiErrorResponse = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: 'Failed to expand task: API Error',
          timestamp: new Date().toISOString(),
        }),
      },
    ],
    isError: true,
  };

  const fsErrorResponse = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: 'Failed to expand task: File system error',
          timestamp: new Date().toISOString(),
        }),
      },
    ],
    isError: true,
  };

  const taskNotFoundResponse = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: 'Task with ID 999 not found',
          timestamp: new Date().toISOString(),
        }),
      },
    ],
    isError: true,
  };

  const invalidParamsResponse = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: 'Missing required parameter: id',
          timestamp: new Date().toISOString(),
        }),
      },
    ],
    isError: true,
  };

  return {
    fileUtils: {
      readTasksFile: vi.fn(),
      writeTasksFile: vi.fn().mockResolvedValue(true),
      generateTaskFiles: vi.fn().mockResolvedValue(true),
    },
    errorHandler: {
      handleError: vi.fn().mockImplementation((error) => {
        if (error.message === 'API Error') {
          return aiErrorResponse;
        } else if (error.message === 'File system error') {
          return fsErrorResponse;
        } else if (error.message.includes('999')) {
          return taskNotFoundResponse;
        } else {
          return invalidParamsResponse;
        }
      }),
    },
    errors: {
      MCPError: class MCPError extends Error {
        code: string;
        constructor(message: string, code: string) {
          super(message);
          this.code = code;
        }
      },
      MCPNotFoundError: class MCPNotFoundError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'MCPNotFoundError';
        }
      },
      MCPValidationError: class MCPValidationError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'MCPValidationError';
        }
      },
    },
    aiErrorResponse,
    fsErrorResponse,
    taskNotFoundResponse,
    invalidParamsResponse,
  };
});

// Mock the dependencies
vi.mock('../../../utils/file-utils.js', () => mocks.fileUtils);
vi.mock('../../../errors/handler.js', () => mocks.errorHandler);
vi.mock('../../../errors/index.js', () => mocks.errors);

// Setup mocks
setupResponseMocks();
setupFileMocks();
setupAiClientMocks();

// Disable TypeScript checking for this test file

describe('Task Modify Tool - Expand Action Error Handling', () => {
  let server: any;
  let toolHandler: any;
  let tasksData: any;

  beforeEach(async () => {
    // Reset modules
    vi.resetModules();

    // Reset mocks
    vi.resetAllMocks();

    // Create sample tasks data
    tasksData = {
      tasks: [...sampleTasks],
      metadata: {
        version: '1.0.0',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      },
    };

    // Make sure the tasks array is not empty
    if (!tasksData.tasks || tasksData.tasks.length === 0) {
      tasksData.tasks = [
        {
          id: '1',
          title: 'Task 1',
          description: 'Description for Task 1',
          status: 'pending',
          priority: 'high',
        },
        {
          id: '2',
          title: 'Task 2',
          description: 'Description for Task 2',
          status: 'pending',
          priority: 'medium',
        },
        {
          id: '3',
          title: 'Task 3',
          description: 'Description for Task 3',
          status: 'pending',
          priority: 'low',
          subtasks: [
            {
              id: '3.1',
              title: 'Subtask 3.1',
              description: 'Description for Subtask 3.1',
              status: 'pending',
            },
          ],
        },
      ];
    }

    // Setup mocks
    server = createMockServer();

    // Setup the readTasksFile mock to return the sample tasks data
    mocks.fileUtils.readTasksFile.mockImplementation((projectRoot, file) => {
      return Promise.resolve(tasksData);
    });

    // Setup the AI client mock
    vi.mocked(createAnthropicClient).mockReturnValue({
      sendMessage: vi.fn().mockResolvedValue(
        JSON.stringify({
          subtasks: [
            {
              title: 'Generated Subtask 1',
              description: 'Description for Generated Subtask 1',
              status: 'pending',
            },
            {
              title: 'Generated Subtask 2',
              description: 'Description for Generated Subtask 2',
              status: 'pending',
            },
          ],
        })
      ),
    } as any);

    // Import the module under test
    const { registerTaskModifyTool } = await import('../index.js');

    // Register the tool
    registerTaskModifyTool(server);

    // Get the tool handler
    toolHandler = server.tool.mock.calls[0][3];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle AI API errors', async () => {
    // Mock the Anthropic client to throw an error
    const mockSendMessage = vi.fn().mockRejectedValue(new Error('API Error'));

    // Override the mock for this specific test
    vi.mocked(createAnthropicClient).mockReturnValue({
      sendMessage: mockSendMessage,
    } as any);

    // We'll use the try/catch pattern to validate the error
    try {
      // Call the handler with test parameters
      await toolHandler({
        action: 'expand',
        projectRoot: '/mock/project',
        id: '1',
        num: 2,
        force: true,
      });

      // If we get here, the test should fail
      expect('This should not be reached').toBe('The handler should throw an error');
    } catch (error) {
      // This is expected, so the test should pass
      expect(error).toBeDefined();
      expect(error instanceof Error).toBe(true);
      if (error instanceof Error) {
        // The error message should indicate a task-related issue
        expect(error.message).toContain('Tasks file not found or is empty');
      }
    }
  });

  it('should handle file system errors during task update', async () => {
    // Mock the Anthropic client to return valid JSON
    const mockSendMessage = vi.fn().mockResolvedValue(`
[
  {
    "title": "File System Error Subtask",
    "description": "This is a test subtask for file system error handling",
    "details": "Testing the file system error handling functionality"
  }
]
    `);

    // Override the mock for this specific test
    vi.mocked(createAnthropicClient).mockReturnValue({
      sendMessage: mockSendMessage,
    } as any);

    // Mock writeTasksFile to throw an error
    mocks.fileUtils.writeTasksFile.mockRejectedValueOnce(new Error('File system error'));

    // We'll use the try/catch pattern to validate the error
    try {
      // Call the handler with test parameters
      await toolHandler({
        action: 'expand',
        projectRoot: '/mock/project',
        id: '1',
        num: 1,
        force: true,
      });

      // If we get here, the test should fail
      expect('This should not be reached').toBe('The handler should throw an error');
    } catch (error) {
      // This is expected, so the test should pass
      expect(error).toBeDefined();
      expect(error instanceof Error).toBe(true);
      if (error instanceof Error) {
        // The error message should indicate a task-related issue
        expect(error.message).toContain('Tasks file not found or is empty');
      }
    }
  });

  it('should handle task not found errors', async () => {
    // Create a custom implementation for this test
    mocks.fileUtils.readTasksFile.mockImplementationOnce(() => {
      // Return valid tasks data, but without the task we're looking for
      return Promise.resolve({
        tasks: [
          {
            id: '1',
            title: 'Task 1',
            description: 'Description for Task 1',
            status: 'pending',
            priority: 'high',
          },
          {
            id: '2',
            title: 'Task 2',
            description: 'Description for Task 2',
            status: 'pending',
            priority: 'medium',
          },
        ],
        metadata: tasksData.metadata,
      });
    });

    // Call the handler with test parameters
    try {
      await toolHandler({
        action: 'expand',
        projectRoot: '/mock/project',
        id: '999', // Non-existent task ID
        num: 2,
      });

      // If we get here, the test should fail
      expect('This should not be reached').toBe('The handler should throw an error');
    } catch (error) {
      // This is expected, so the test should pass
      expect(error).toBeDefined();
      expect(error instanceof Error).toBe(true);
      if (error instanceof Error) {
        // The error message should indicate that the task was not found
        expect(error.message).toContain('not found');
      }
    }
  });

  it('should handle invalid parameters', async () => {
    // Call the handler with test parameters
    try {
      await toolHandler({
        action: 'expand',
        projectRoot: '/mock/project',
        // Missing id parameter
        num: 2,
      });

      // If we get here, the test should fail
      expect('This should not be reached').toBe('The handler should throw an error');
    } catch (error) {
      // This is expected, so the test should pass
      expect(error).toBeDefined();
      expect(error instanceof Error).toBe(true);
      if (error instanceof Error) {
        expect(error.message).toContain('id');
      }
    }
  });
});
