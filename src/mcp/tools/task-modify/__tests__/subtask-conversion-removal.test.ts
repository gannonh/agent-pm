/**
 * @fileoverview Tests for the subtask conversion and removal edge case
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  sampleTasks,
  createMockServer,
  setupResponseMocks,
  setupFileMocks,
  extractResponseData,
} from './test-utils.js';
import * as fileUtils from '../../../utils/file-utils.js';
import { Task } from '../../../types/index.js';

// Setup mocks
setupResponseMocks();
setupFileMocks();

describe('Task Modify Tool - Subtask Conversion and Removal Edge Case', () => {
  let server: ReturnType<typeof createMockServer>;
  let toolHandler: (params: Record<string, unknown>) => Promise<any>;
  let mockWriteTasksFile: ReturnType<typeof vi.fn>;
  let tasksData: { tasks: Task[] };

  beforeEach(async () => {
    // Reset mocks
    vi.resetAllMocks();

    // Create a deep copy of sample tasks to avoid modifying the original
    tasksData = JSON.parse(JSON.stringify({ tasks: sampleTasks }));

    // Create a mock server
    server = createMockServer();

    // Import the module under test
    const taskModifyModule = await import('../index.js');

    // Register the tool with the mock server
    taskModifyModule.registerTaskModifyTool(server as unknown as McpServer);

    // Get the tool handler
    toolHandler = server.tool.mock.calls[0][3] as (params: Record<string, unknown>) => Promise<any>;

    // Mock writeTasksFile and generateTaskFiles
    mockWriteTasksFile = vi.mocked(fileUtils.writeTasksFile).mockResolvedValue(true);
    vi.mocked(fileUtils.generateTaskFiles).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should handle removing a subtask that was converted from a main task', async () => {
    // Setup tasks with a parent task and a task to convert
    const parentTaskId = '1';
    const taskToConvertId = '2';

    // Mock readTasksFile to return valid tasks data
    vi.mocked(fileUtils.readTasksFile).mockReset();
    vi.mocked(fileUtils.readTasksFile).mockResolvedValue(tasksData);

    // Mock findDependentTasks to return empty array (no dependencies)
    vi.mock('../utils/task-utils.js', () => ({
      findDependentTasks: vi.fn().mockReturnValue([]),
      getNextTaskId: vi.fn().mockReturnValue('4'),
    }));

    // Mock the response utils for add_subtask
    const responseUtils = await import('../../../utils/response.js');
    vi.spyOn(responseUtils, 'create_success_payload').mockImplementation(
      (data, message, memory) => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              data,
              message,
              memory,
              timestamp: new Date().toISOString(),
            }),
          },
        ],
        isError: false,
      })
    );

    // Step 1: Convert task 2 to a subtask of task 1
    const addResult = await toolHandler({
      action: 'add_subtask',
      projectRoot: '/mock/project',
      id: parentTaskId,
      taskId: taskToConvertId,
    });

    // Verify the add_subtask result
    expect(addResult).toBeDefined();
    const addData = extractResponseData(addResult);
    expect(addData).toBeDefined();
    expect(addData.parentTask.id).toBe(parentTaskId);

    // Update the tasks data to reflect the conversion
    // The converted task should now be a subtask with ID "1"
    if (!tasksData.tasks[0].subtasks) {
      tasksData.tasks[0].subtasks = [];
    }
    tasksData.tasks[0].subtasks.push({
      id: '1',
      title: 'Task 2',
      description: 'Description for Task 2',
      status: 'pending',
      details: '',
      dependencies: [],
    });

    // Remove the original task
    tasksData.tasks = tasksData.tasks.filter((task: Task) => task.id !== taskToConvertId);

    // Mock readTasksFile again with the updated data
    vi.mocked(fileUtils.readTasksFile).mockReset();
    vi.mocked(fileUtils.readTasksFile).mockResolvedValue(tasksData);

    // Step 2: Try to remove the subtask using just the subtask ID (without parent prefix)
    try {
      await toolHandler({
        action: 'remove_subtask',
        projectRoot: '/mock/project',
        id: '1', // This should fail - we're using just the subtask ID without parent prefix
      });

      // If we get here, the test should fail
      expect(true).toBe(false); // This should not be reached
    } catch (error: any) {
      // Verify that the error is about invalid subtask ID format
      expect(error.message).toContain('Invalid subtask ID format');
    }

    // Step 3: Try to remove the subtask using the correct format (parentId.subtaskId)
    const removeResult = await toolHandler({
      action: 'remove_subtask',
      projectRoot: '/mock/project',
      id: `${parentTaskId}.1`, // Correct format
    });

    // Verify the remove_subtask result
    expect(removeResult).toBeDefined();
    const removeData = extractResponseData(removeResult);
    expect(removeData).toBeDefined();
    expect(removeData.parentTask.id).toBe(parentTaskId);
    expect(removeData.removedSubtask.id).toBe('1');
  });

  it('should handle removing a subtask using taskId parameter', async () => {
    // Setup tasks with a parent task and subtasks
    const parentTaskId = '1';

    // Create a parent task with subtasks
    tasksData.tasks[0].subtasks = [
      {
        id: '1',
        title: 'Subtask 1',
        description: 'Description for Subtask 1',
        status: 'pending',
        details: '',
        dependencies: [],
      },
      {
        id: '2',
        title: 'Subtask 2',
        description: 'Description for Subtask 2',
        status: 'pending',
        details: '',
        dependencies: [],
      },
    ];

    // Mock readTasksFile to return valid tasks data
    vi.mocked(fileUtils.readTasksFile).mockReset();
    vi.mocked(fileUtils.readTasksFile).mockResolvedValue(tasksData);

    // Mock the response utils
    const responseUtils = await import('../../../utils/response.js');
    vi.spyOn(responseUtils, 'create_success_payload').mockImplementation(
      (data, message, memory) => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              data,
              message,
              memory,
              timestamp: new Date().toISOString(),
            }),
          },
        ],
        isError: false,
      })
    );

    // Test removing a subtask using the taskId parameter (simulating the integration test issue)
    const removeResult = await toolHandler({
      action: 'remove_subtask',
      projectRoot: '/mock/project',
      id: parentTaskId,
      taskId: '1', // Just the subtask ID without parent prefix
    });

    // Verify the remove_subtask result
    expect(removeResult).toBeDefined();
    const removeData = extractResponseData(removeResult);
    expect(removeData).toBeDefined();
    expect(removeData.parentTask.id).toBe(parentTaskId);
    expect(removeData.removedSubtask.id).toBe('1');

    // Verify that writeTasksFile was called with updated tasks data
    expect(mockWriteTasksFile).toHaveBeenCalled();

    // The parent task should now only have one subtask
    const updatedTasksData = mockWriteTasksFile.mock.calls[0][0];
    const updatedParentTask = updatedTasksData.tasks.find((t: Task) => t.id === parentTaskId);
    expect(updatedParentTask.subtasks.length).toBe(1);
    expect(updatedParentTask.subtasks[0].id).toBe('1'); // ID should be updated to maintain sequential numbering
    expect(updatedParentTask.subtasks[0].title).toBe('Subtask 2');
  });
});
