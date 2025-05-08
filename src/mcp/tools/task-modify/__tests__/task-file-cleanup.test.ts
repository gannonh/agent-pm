/**
 * @fileoverview Tests for task file cleanup when converting tasks to subtasks
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
import path from 'path';
import fs from 'fs/promises';

// Setup mocks
setupResponseMocks();
setupFileMocks();

describe('Task Modify Tool - Task File Cleanup', () => {
  let server: ReturnType<typeof createMockServer>;
  let toolHandler: (params: Record<string, unknown>) => Promise<any>;
  let mockWriteTasksFile: ReturnType<typeof vi.fn>;
  let mockGenerateTaskFiles: ReturnType<typeof vi.fn>;
  let mockUnlink: ReturnType<typeof vi.fn>;
  let tasksData: { tasks: Task[] };
  const projectRoot = '/mock/project';

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
    mockGenerateTaskFiles = vi.mocked(fileUtils.generateTaskFiles).mockResolvedValue(true);

    // Mock fs.unlink
    mockUnlink = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(fs, 'unlink').mockImplementation(mockUnlink);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should delete the task file when a task is converted to a subtask', async () => {
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

    // Convert task 2 to a subtask of task 1
    const addResult = await toolHandler({
      action: 'add_subtask',
      projectRoot,
      id: parentTaskId,
      taskId: taskToConvertId,
    });

    // Verify the add_subtask result
    expect(addResult).toBeDefined();
    const addData = extractResponseData(addResult);
    expect(addData).toBeDefined();
    expect(addData.parentTask.id).toBe(parentTaskId);

    // Verify that the task file was deleted
    const expectedTaskFilePath = path.join(
      projectRoot,
      'apm-artifacts',
      `task_${taskToConvertId.padStart(3, '0')}.md`
    );
    expect(mockUnlink).toHaveBeenCalledWith(expectedTaskFilePath);
  });
});
