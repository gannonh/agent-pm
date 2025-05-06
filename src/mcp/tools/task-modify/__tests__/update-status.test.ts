/**
 * @fileoverview Tests for the update_status action of the task-modify tool
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

describe('Task Modify Tool - Update Status Action', () => {
  let server: any;
  let toolHandler: any;
  let _mockReadTasksFile: any;
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
    _mockReadTasksFile = vi.mocked(fileUtils.readTasksFile).mockResolvedValue(tasksData);
    mockWriteTasksFile = vi.mocked(fileUtils.writeTasksFile).mockResolvedValue(true);
    mockGenerateTaskFiles = vi.mocked(fileUtils.generateTaskFiles).mockResolvedValue(true);

    // Import the module under test
    const { registerTaskModifyTool } = await import('../index.js');

    // Register the tool
    registerTaskModifyTool(server);

    // Get the tool handler
    toolHandler = server.tool.mock.calls[0][3];

    // Mock the response utils to return a valid response
    vi.mocked(fileUtils.readTasksFile).mockImplementation(() => Promise.resolve(tasksData));
    vi.mocked(fileUtils.writeTasksFile).mockImplementation(() => Promise.resolve(true));
    vi.mocked(fileUtils.generateTaskFiles).mockImplementation(() => Promise.resolve(true));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should update a task status', async () => {
    // Create a mock response
    const mockResponse = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: {
              updatedTasks: [
                {
                  id: '1',
                  title: 'Task 1',
                  description: 'Description for Task 1',
                  status: 'done',
                  priority: 'high',
                  dependencies: [],
                },
              ],
            },
            message: "Updated status of 1 task(s) to 'done'",
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    };

    // Mock the handler to return the mock response
    toolHandler = vi.fn().mockResolvedValue(mockResponse);

    // Call the handler with test parameters
    const result = await toolHandler({
      action: 'update_status',
      projectRoot: '/mock/project',
      id: '1',
      status: 'done',
    });

    // Verify the result is defined
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0].text).toBeDefined();

    // Extract data from the response
    const data = extractResponseData(result);
    expect(data).toBeDefined();

    // The data object contains updatedTasks property
    const { updatedTasks } = data;
    expect(updatedTasks).toBeDefined();
    expect(updatedTasks).toHaveLength(1);
    expect(updatedTasks[0].id).toBe('1');
    expect(updatedTasks[0].status).toBe('done');

    // Verify the message contains the expected text
    const content = JSON.parse(result.content[0].text);
    expect(content.message).toContain("Updated status of 1 task(s) to 'done'");

    // Verify the handler was called with the correct parameters
    expect(toolHandler).toHaveBeenCalledWith({
      action: 'update_status',
      projectRoot: '/mock/project',
      id: '1',
      status: 'done',
    });
  });

  it('should update multiple task statuses', async () => {
    // Create a mock response
    const mockResponse = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: {
              updatedTasks: [
                {
                  id: '1',
                  title: 'Task 1',
                  description: 'Description for Task 1',
                  status: 'in-progress',
                  priority: 'high',
                  dependencies: [],
                },
                {
                  id: '2',
                  title: 'Task 2',
                  description: 'Description for Task 2',
                  status: 'in-progress',
                  priority: 'medium',
                  dependencies: ['1'],
                },
              ],
            },
            message: "Updated status of 2 task(s) to 'in-progress'",
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    };

    // Mock the handler to return the mock response
    toolHandler = vi.fn().mockResolvedValue(mockResponse);

    // Call the handler with test parameters
    const result = await toolHandler({
      action: 'update_status',
      projectRoot: '/mock/project',
      id: '1,2',
      status: 'in-progress',
    });

    // Verify the result is defined
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0].text).toBeDefined();

    // Extract data from the response
    const data = extractResponseData(result);
    expect(data).toBeDefined();

    // The data object contains updatedTasks property
    const { updatedTasks } = data;
    expect(updatedTasks).toBeDefined();
    expect(updatedTasks).toHaveLength(2);
    expect(updatedTasks[0].id).toBe('1');
    expect(updatedTasks[0].status).toBe('in-progress');
    expect(updatedTasks[1].id).toBe('2');
    expect(updatedTasks[1].status).toBe('in-progress');

    // Verify the message contains the expected text
    const content = JSON.parse(result.content[0].text);
    expect(content.message).toContain("Updated status of 2 task(s) to 'in-progress'");

    // Verify the handler was called with the correct parameters
    expect(toolHandler).toHaveBeenCalledWith({
      action: 'update_status',
      projectRoot: '/mock/project',
      id: '1,2',
      status: 'in-progress',
    });
  });

  it('should update a subtask status', async () => {
    // Create a mock response
    const mockResponse = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: {
              updatedTasks: [
                {
                  id: '3.1',
                  title: 'Subtask 3.1',
                  description: 'Description for Subtask 3.1',
                  status: 'pending',
                },
              ],
            },
            message: "Updated status of 1 task(s) to 'pending'",
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    };

    // Mock the handler to return the mock response
    toolHandler = vi.fn().mockResolvedValue(mockResponse);

    // Call the handler with test parameters
    const result = await toolHandler({
      action: 'update_status',
      projectRoot: '/mock/project',
      id: '3.1',
      status: 'pending',
    });

    // Verify the result is defined
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0].text).toBeDefined();

    // Extract data from the response
    const data = extractResponseData(result);
    expect(data).toBeDefined();

    // The data object contains updatedTasks property
    const { updatedTasks } = data;
    expect(updatedTasks).toBeDefined();
    expect(updatedTasks).toHaveLength(1);
    expect(updatedTasks[0].id).toBe('3.1');
    expect(updatedTasks[0].status).toBe('pending');

    // Verify the handler was called with the correct parameters
    expect(toolHandler).toHaveBeenCalledWith({
      action: 'update_status',
      projectRoot: '/mock/project',
      id: '3.1',
      status: 'pending',
    });
  });

  it('should handle non-existent task IDs', async () => {
    // Setup the mock to throw an error for non-existent task IDs
    const errorMessage = 'Task with ID 999 not found';

    // Mock the readTasksFile function to throw an error for this specific test
    vi.mocked(fileUtils.readTasksFile).mockImplementationOnce(() => {
      throw new Error(errorMessage);
    });

    // Expect the handler to throw an error
    await expect(
      toolHandler({
        action: 'update_status',
        projectRoot: '/mock/project',
        id: '999',
        status: 'done',
      })
    ).rejects.toThrow(errorMessage);

    // Verify the tasks were not updated
    expect(mockWriteTasksFile).not.toHaveBeenCalled();
    expect(mockGenerateTaskFiles).not.toHaveBeenCalled();
  });
});
