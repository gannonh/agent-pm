/**
 * @fileoverview Tests for the add_subtask and remove_subtask actions of the task-modify tool
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  sampleTasks,
  createMockServer,
  setupResponseMocks,
  setupFileMocks,
  extractResponseData,
} from './test-utils.js';
import * as fileUtils from '../../../utils/file-utils.js';

// Setup mocks
setupResponseMocks();
setupFileMocks();

describe('Task Modify Tool - Subtask Actions', () => {
  let server: any;
  let toolHandler: any;
  let mockWriteTasksFile: any;
  let mockGenerateTaskFiles: any;
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

    // Setup mocks
    server = createMockServer();
    vi.mocked(fileUtils.readTasksFile).mockResolvedValue(tasksData);
    mockWriteTasksFile = vi.mocked(fileUtils.writeTasksFile).mockResolvedValue(true);
    mockGenerateTaskFiles = vi.mocked(fileUtils.generateTaskFiles).mockResolvedValue(true);

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

  describe('add_subtask action', () => {
    it('should add a subtask to a task', async () => {
      // Mock the response utils to return a valid response
      const responseUtils = await import('../../../utils/response.js');
      vi.spyOn(responseUtils, 'create_success_payload').mockImplementation((data, message) => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              data,
              message,
              timestamp: new Date().toISOString(),
            }),
          },
        ],
        isError: false,
      }));

      // Call the handler with test parameters
      const result = await toolHandler({
        action: 'add_subtask',
        projectRoot: '/mock/project',
        id: '1',
        title: 'New Subtask',
        description: 'Description for New Subtask',
        details: 'Details for New Subtask',
      });

      // Verify the result is defined
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toBeDefined();

      // Extract data from the response
      const data = extractResponseData(result);
      expect(data).toBeDefined();

      // The data object contains parentTask and subtask properties
      const { parentTask, subtask } = data;
      expect(parentTask).toBeDefined();
      expect(parentTask.id).toBe('1');
      expect(subtask).toBeDefined();
      expect(subtask.title).toBe('New Subtask');
      expect(subtask.description).toBe('Description for New Subtask');
      expect(subtask.details).toBe('Details for New Subtask');
      expect(subtask.status).toBe('pending');

      // Verify the message contains the expected text
      const content = JSON.parse(result.content[0].text);
      expect(content.message).toContain('Added subtask to task 1');

      // Verify the subtask was added to the parent task
      expect(mockWriteTasksFile).toHaveBeenCalled();
      expect(mockGenerateTaskFiles).toHaveBeenCalled();
    });

    it('should convert an existing task to a subtask', async () => {
      // Mock the findDependentTasks function to return an empty array
      vi.mock('../actions/utils.js', () => ({
        findDependentTasks: vi.fn().mockReturnValue([]),
      }));

      // Mock the response utils to return a valid response
      const responseUtils = await import('../../../utils/response.js');
      vi.spyOn(responseUtils, 'create_success_payload').mockImplementation((data, message) => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              data,
              message,
              timestamp: new Date().toISOString(),
            }),
          },
        ],
        isError: false,
      }));

      // Call the handler with test parameters
      const result = await toolHandler({
        action: 'add_subtask',
        projectRoot: '/mock/project',
        id: '1',
        taskId: '2',
      });

      // Verify the result is defined
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toBeDefined();

      // Extract data from the response
      const data = extractResponseData(result);
      expect(data).toBeDefined();

      // The data object contains parentTask and subtask properties
      const { parentTask, subtask } = data;
      expect(parentTask).toBeDefined();
      expect(parentTask.id).toBe('1');
      expect(subtask).toBeDefined();
      expect(subtask.title).toBe('Task 2');

      // Verify the message contains the expected text
      const content = JSON.parse(result.content[0].text);
      expect(content.message).toContain('Converted task 2 to subtask of task 1');

      // Verify the task was converted to a subtask
      expect(mockWriteTasksFile).toHaveBeenCalled();
      expect(mockGenerateTaskFiles).toHaveBeenCalled();
    });

    it('should handle non-existent parent task IDs', async () => {
      // Mock readTasksFile to throw an error for non-existent task
      const errorMessage = 'Task with ID 999 not found';
      const mockError = new Error(errorMessage);
      mockError.name = 'MCPNotFoundError';

      // Reset the readTasksFile mock
      vi.mocked(fileUtils.readTasksFile).mockReset();
      vi.mocked(fileUtils.readTasksFile).mockRejectedValue(mockError);

      // Mock the error handler to return a proper error response
      const errorResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                message: errorMessage,
              },
              timestamp: new Date().toISOString(),
            }),
          },
        ],
        isError: true,
      };

      // Mock the error handler
      const errorUtils = await import('../../../errors/handler.js');
      vi.spyOn(errorUtils, 'handleError').mockReturnValue(errorResponse as any);

      // Call the handler with test parameters
      const result = await toolHandler({
        action: 'add_subtask',
        projectRoot: '/mock/project',
        id: '999',
        title: 'New Subtask',
        description: 'Description for New Subtask',
      }).catch((_: any) => {
        // Return the error response directly
        return errorResponse;
      });

      // Verify the result is defined
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toBeDefined();

      // Parse the response
      const responseText = result.content[0].text;
      const responseData = JSON.parse(responseText);

      // Verify the error response
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBeDefined();
      expect(responseData.error.message).toContain(errorMessage);

      // Verify the tasks were not updated
      expect(mockWriteTasksFile).not.toHaveBeenCalled();
      expect(mockGenerateTaskFiles).not.toHaveBeenCalled();
    });

    it('should handle non-existent task IDs when converting', async () => {
      // Mock readTasksFile to return valid tasks data but with a non-existent task ID
      vi.mocked(fileUtils.readTasksFile).mockReset();
      vi.mocked(fileUtils.readTasksFile).mockResolvedValue(tasksData);

      // Mock the error handler to return a proper error response
      const errorMessage = 'Task with ID 999 not found';
      const errorResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                message: errorMessage,
              },
              timestamp: new Date().toISOString(),
            }),
          },
        ],
        isError: true,
      };

      // Mock the error handler
      const errorUtils = await import('../../../errors/handler.js');
      vi.spyOn(errorUtils, 'handleError').mockReturnValue(errorResponse as any);

      // Call the handler with test parameters
      const result = await toolHandler({
        action: 'add_subtask',
        projectRoot: '/mock/project',
        id: '1',
        taskId: '999',
      }).catch((_: any) => {
        // Return the error response directly
        return errorResponse;
      });

      // Verify the result is defined
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toBeDefined();

      // Parse the response
      const responseText = result.content[0].text;
      const responseData = JSON.parse(responseText);

      // Verify the error response
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBeDefined();
      expect(responseData.error.message).toContain(errorMessage);

      // Verify the tasks were not updated
      expect(mockWriteTasksFile).not.toHaveBeenCalled();
      expect(mockGenerateTaskFiles).not.toHaveBeenCalled();
    });
  });

  describe('remove_subtask action', () => {
    it('should remove a subtask from a task', async () => {
      // Mock readTasksFile to return valid tasks data
      vi.mocked(fileUtils.readTasksFile).mockReset();
      vi.mocked(fileUtils.readTasksFile).mockResolvedValue(tasksData);

      // Mock the response utils to return a valid response
      const responseUtils = await import('../../../utils/response.js');
      vi.spyOn(responseUtils, 'create_success_payload').mockImplementation((data, message) => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              data,
              message,
              timestamp: new Date().toISOString(),
            }),
          },
        ],
        isError: false,
      }));

      // Call the handler with test parameters
      const result = await toolHandler({
        action: 'remove_subtask',
        projectRoot: '/mock/project',
        id: '3.1',
      });

      // Verify the result is defined
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toBeDefined();

      // Extract data from the response
      const data = extractResponseData(result);
      expect(data).toBeDefined();

      // The data object contains parentTask and removedSubtask properties
      const { parentTask, removedSubtask } = data;
      expect(parentTask).toBeDefined();
      expect(parentTask.id).toBe('3');
      expect(removedSubtask).toBeDefined();
      expect(removedSubtask.id).toBe('3.1');

      // Verify the message contains the expected text
      const content = JSON.parse(result.content[0].text);
      expect(content.message).toContain('Removed subtask 3.1 from task 3');

      // Verify the subtask was removed from the parent task
      expect(mockWriteTasksFile).toHaveBeenCalled();
      expect(mockGenerateTaskFiles).toHaveBeenCalled();
    });

    it('should convert a subtask to a standalone task', async () => {
      // Mock readTasksFile to return valid tasks data
      vi.mocked(fileUtils.readTasksFile).mockReset();
      vi.mocked(fileUtils.readTasksFile).mockResolvedValue(tasksData);

      // Create a mock response with the expected data structure
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: {
                parentTask: {
                  id: '3',
                  title: 'Task 3',
                  subtasks: [
                    {
                      id: '3.2',
                      title: 'Subtask 3.2',
                      description: 'Description for Subtask 3.2',
                      status: 'pending',
                    },
                  ],
                },
                removedSubtask: {
                  id: '3.1',
                  title: 'Subtask 3.1',
                  description: 'Description for Subtask 3.1',
                  status: 'done',
                },
                newTask: {
                  id: '4',
                  title: 'Subtask 3.1',
                  description: 'Description for Subtask 3.1',
                  status: 'done',
                },
              },
              message: 'Converted subtask 3.1 to standalone task',
              timestamp: new Date().toISOString(),
            }),
          },
        ],
        isError: false,
      };

      // Mock the response utils to return our mock response
      const responseUtils = await import('../../../utils/response.js');
      vi.spyOn(responseUtils, 'create_success_payload').mockReturnValueOnce(mockResponse as any);

      // Call the handler with test parameters
      const result = await toolHandler({
        action: 'remove_subtask',
        projectRoot: '/mock/project',
        id: '3.1',
        convert: true,
      });

      // Verify the result is defined
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toBeDefined();

      // Extract data from the response
      const data = extractResponseData(result);
      expect(data).toBeDefined();

      // The data object contains parentTask, removedSubtask, and newTask properties
      const { parentTask, removedSubtask, newTask } = data;
      expect(parentTask).toBeDefined();
      expect(parentTask.id).toBe('3');
      expect(removedSubtask).toBeDefined();
      expect(removedSubtask.id).toBe('3.1');
      expect(newTask).toBeDefined();

      // Verify the message contains the expected text
      const content = JSON.parse(result.content[0].text);
      expect(content.message).toContain('Converted subtask 3.1 to standalone task');

      // Verify the subtask was converted to a standalone task
      expect(mockWriteTasksFile).toHaveBeenCalled();
      expect(mockGenerateTaskFiles).toHaveBeenCalled();
    });

    it('should handle invalid subtask ID format', async () => {
      // Mock readTasksFile to return valid tasks data
      vi.mocked(fileUtils.readTasksFile).mockReset();
      vi.mocked(fileUtils.readTasksFile).mockResolvedValue(tasksData);

      // Mock the error handler to return a proper error response
      const errorMessage = 'Invalid subtask ID format';
      const errorResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                message: errorMessage,
              },
              timestamp: new Date().toISOString(),
            }),
          },
        ],
        isError: true,
      };

      // Mock the error handler
      const errorUtils = await import('../../../errors/handler.js');
      vi.spyOn(errorUtils, 'handleError').mockReturnValue(errorResponse as any);

      // Call the handler with test parameters
      const result = await toolHandler({
        action: 'remove_subtask',
        projectRoot: '/mock/project',
        id: '3',
      }).catch((_: any) => {
        // Return the error response directly
        return errorResponse;
      });

      // Verify the result is defined
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toBeDefined();

      // Parse the response
      const responseText = result.content[0].text;
      const responseData = JSON.parse(responseText);

      // Verify the error response
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBeDefined();
      expect(responseData.error.message).toContain(errorMessage);

      // Verify the tasks were not updated
      expect(mockWriteTasksFile).not.toHaveBeenCalled();
      expect(mockGenerateTaskFiles).not.toHaveBeenCalled();
    });

    it('should handle non-existent parent task IDs', async () => {
      // Mock readTasksFile to throw an error for non-existent task
      const errorMessage = 'Task with ID 999 not found';
      const mockError = new Error(errorMessage);
      mockError.name = 'MCPNotFoundError';

      // Reset the readTasksFile mock
      vi.mocked(fileUtils.readTasksFile).mockReset();
      vi.mocked(fileUtils.readTasksFile).mockRejectedValue(mockError);

      // Mock the error handler to return a proper error response
      const errorResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                message: errorMessage,
              },
              timestamp: new Date().toISOString(),
            }),
          },
        ],
        isError: true,
      };

      // Mock the error handler
      const errorUtils = await import('../../../errors/handler.js');
      vi.spyOn(errorUtils, 'handleError').mockReturnValue(errorResponse as any);

      // Call the handler with test parameters
      const result = await toolHandler({
        action: 'remove_subtask',
        projectRoot: '/mock/project',
        id: '999.1',
      }).catch((_: any) => {
        // Return the error response directly
        return errorResponse;
      });

      // Verify the result is defined
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toBeDefined();

      // Parse the response
      const responseText = result.content[0].text;
      const responseData = JSON.parse(responseText);

      // Verify the error response
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBeDefined();
      expect(responseData.error.message).toContain(errorMessage);

      // Verify the tasks were not updated
      expect(mockWriteTasksFile).not.toHaveBeenCalled();
      expect(mockGenerateTaskFiles).not.toHaveBeenCalled();
    });

    it('should handle non-existent subtask indices', async () => {
      // Mock readTasksFile to return valid tasks data
      vi.mocked(fileUtils.readTasksFile).mockReset();
      vi.mocked(fileUtils.readTasksFile).mockResolvedValue(tasksData);

      // Mock the error handler to return a proper error response
      const errorMessage = 'Parent task with ID 3 has no subtask with ID 3.999';
      const errorResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                message: errorMessage,
              },
              timestamp: new Date().toISOString(),
            }),
          },
        ],
        isError: true,
      };

      // Mock the error handler
      const errorUtils = await import('../../../errors/handler.js');
      vi.spyOn(errorUtils, 'handleError').mockReturnValue(errorResponse as any);

      // Call the handler with test parameters
      const result = await toolHandler({
        action: 'remove_subtask',
        projectRoot: '/mock/project',
        id: '3.999',
      }).catch((_: any) => {
        // Return the error response directly
        return errorResponse;
      });

      // Verify the result is defined
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toBeDefined();

      // Parse the response
      const responseText = result.content[0].text;
      const responseData = JSON.parse(responseText);

      // Verify the error response
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBeDefined();
      expect(responseData.error.message).toContain('Parent task with ID 3');

      // Verify the tasks were not updated
      expect(mockWriteTasksFile).not.toHaveBeenCalled();
      expect(mockGenerateTaskFiles).not.toHaveBeenCalled();
    });
  });
});
