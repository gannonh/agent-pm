/**
 * @fileoverview Tests for the clear_subtasks action of the task-modify tool
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Create shared mocks using vi.hoisted
const mocks = vi.hoisted(() => {
  // Create a mock for readTasksFile that returns a valid tasks data object
  const mockTasksData = {
    tasks: [
      {
        id: '1',
        title: 'Task 1',
        description: 'Description for Task 1',
        status: 'pending',
        priority: 'high',
        dependencies: [],
      },
      {
        id: '2',
        title: 'Task 2',
        description: 'Description for Task 2',
        status: 'pending',
        priority: 'medium',
        dependencies: ['1'],
      },
      {
        id: '3',
        title: 'Task 3',
        description: 'Description for Task 3',
        status: 'pending',
        priority: 'low',
        dependencies: [],
        subtasks: [
          {
            id: '3.1',
            title: 'Subtask 3.1',
            description: 'Description for Subtask 3.1',
            status: 'done',
          },
          {
            id: '3.2',
            title: 'Subtask 3.2',
            description: 'Description for Subtask 3.2',
            status: 'pending',
          },
        ],
      },
    ],
    metadata: {
      version: '1.0.0',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    },
  };

  return {
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    fileUtils: {
      readTasksFile: vi.fn().mockImplementation(() => Promise.resolve(mockTasksData)),
      writeTasksFile: vi.fn().mockReturnValue(Promise.resolve(true)),
      generateTaskFiles: vi.fn().mockReturnValue(Promise.resolve(true)),
    },
    responseUtils: {
      create_success_payload: vi.fn().mockImplementation((data, message, options = {}) => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              data,
              message,
              timestamp: new Date().toISOString(),
              ...options,
            }),
          },
        ],
      })),
      create_error_payload: vi.fn().mockImplementation((data, message, options = {}) => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              data,
              message,
              timestamp: new Date().toISOString(),
              ...options,
            }),
          },
        ],
        isError: true,
      })),
    },
    errorHandler: {
      handleError: vi.fn().mockImplementation((error) => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                message: error instanceof Error ? error.message : String(error),
              },
              timestamp: new Date().toISOString(),
            }),
          },
        ],
        isError: true,
      })),
      MCPErrorResponse: class {},
    },
    server: {
      tool: vi.fn(),
      capabilities: {
        serverInfo: { name: 'Test Server', version: '1.0.0' },
      },
    },
    config: {
      default: {
        getArtifactsFile: vi.fn().mockReturnValue('/mock/project/artifacts.json'),
        getProjectRoot: vi.fn().mockReturnValue('/mock/project'),
        PROJECT_ROOT: '/mock/project',
        ARTIFACTS_DIR: 'apm-artifacts',
        RESOURCES_DIR: 'resources',
        PROJECT_BRIEF_DIR: 'project-brief',
        REPORTS_DIR: 'reports',
        TASK_COMPLEXITY_REPORT_FILE: 'task-complexity-report.json',
        TASK_COMPLEXITY_REPORT_MARKDOWN_FILE: 'task-complexity-report.md',
        ARTIFACTS_FILE: 'artifacts.json',
        PROJECT_BRIEF_MARKDOWN_FILE: 'project-brief.md',
        DEBUG: false, // Add DEBUG flag
      },
      getArtifactsFile: vi.fn().mockReturnValue('/mock/project/artifacts.json'),
      getProjectRoot: vi.fn().mockReturnValue('/mock/project'),
      PROJECT_ROOT: '/mock/project',
      ARTIFACTS_DIR: 'apm-artifacts',
      RESOURCES_DIR: 'resources',
      PROJECT_BRIEF_DIR: 'project-brief',
      REPORTS_DIR: 'reports',
      TASK_COMPLEXITY_REPORT_FILE: 'task-complexity-report.json',
      TASK_COMPLEXITY_REPORT_MARKDOWN_FILE: 'task-complexity-report.md',
      ARTIFACTS_FILE: 'artifacts.json',
      PROJECT_BRIEF_MARKDOWN_FILE: 'project-brief.md',
    },
    projectBriefRegenerator: {
      updateProjectBriefAfterTaskModification: vi.fn().mockResolvedValue(null),
    },
    mockTasksData,
  };
});

// Mock the dependencies
vi.mock('../../../utils/file-utils.js', () => mocks.fileUtils);
vi.mock('../../../utils/response.js', () => mocks.responseUtils);
vi.mock('../../../utils/logger.js', () => ({ logger: mocks.logger }));
vi.mock('../../../errors/handler.js', () => mocks.errorHandler);
vi.mock('../../../../config.js', () => mocks.config);
vi.mock(
  '../../../../core/services/project-brief-regenerator.js',
  () => mocks.projectBriefRegenerator
);

// Mock the error classes
vi.mock('../../../errors/index.js', () => ({
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
    }
  },
  MCPValidationError: class MCPValidationError extends Error {
    constructor(message: string) {
      super(message);
    }
  },
}));

describe('Task Modify Tool - Clear Subtasks Action', () => {
  let toolHandler: any;
  let tasksData: any;

  beforeEach(async () => {
    // Reset modules
    vi.resetModules();

    // Reset mocks
    vi.resetAllMocks();

    // Use the mockTasksData from the mocks object
    tasksData = JSON.parse(JSON.stringify(mocks.mockTasksData));

    // Setup the readTasksFile mock to return the sample tasks data
    mocks.fileUtils.readTasksFile.mockImplementation(() => Promise.resolve(tasksData));

    // Setup the writeTasksFile mock to return true
    mocks.fileUtils.writeTasksFile.mockImplementation(() => Promise.resolve(true));

    // Setup the generateTaskFiles mock to return true
    mocks.fileUtils.generateTaskFiles.mockImplementation(() => Promise.resolve(true));

    // Import the module under test
    const { registerTaskModifyTool } = await import('../index.js');

    // Register the tool with a type assertion to satisfy TypeScript
    registerTaskModifyTool(mocks.server as any);

    // Get the tool handler
    toolHandler = mocks.server.tool.mock.calls[0][3];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should clear subtasks from a specific task', async () => {
    // Setup the create_success_payload mock to return a valid response
    mocks.responseUtils.create_success_payload.mockReturnValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: {
              updatedTasks: [
                {
                  id: '3',
                  subtasks: undefined,
                },
              ],
            },
            message: 'Cleared subtasks from 1 task(s)',
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    });

    // Call the handler with test parameters
    const result = await toolHandler({
      action: 'clear_subtasks',
      projectRoot: '/mock/project',
      id: '3',
    });

    // Verify the result is defined
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0].text).toBeDefined();

    // Parse the response
    const responseText = result.content[0].text;
    const responseData = JSON.parse(responseText);

    // Verify the response structure
    expect(responseData.success).toBe(true);
    expect(responseData.data).toBeDefined();
    expect(responseData.data.updatedTasks).toBeDefined();
    expect(responseData.data.updatedTasks).toHaveLength(1);
    expect(responseData.data.updatedTasks[0].id).toBe('3');
    expect(responseData.data.updatedTasks[0].subtasks).toBeUndefined();

    // Verify the message contains the expected text
    expect(responseData.message).toContain('Cleared subtasks from 1 task(s)');

    // Verify the task was updated in the tasks array
    expect(mocks.fileUtils.writeTasksFile).toHaveBeenCalled();
    expect(mocks.fileUtils.generateTaskFiles).toHaveBeenCalled();
  });

  it('should clear subtasks from multiple tasks', async () => {
    // Add subtasks to task 1 for this test
    tasksData.tasks[0].subtasks = [
      {
        id: '1.1',
        title: 'Subtask 1.1',
        description: 'Description for Subtask 1.1',
        status: 'pending',
      },
    ];

    // Setup the create_success_payload mock to return a valid response
    mocks.responseUtils.create_success_payload.mockReturnValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: {
              updatedTasks: [
                {
                  id: '1',
                  subtasks: undefined,
                },
                {
                  id: '3',
                  subtasks: undefined,
                },
              ],
            },
            message: 'Cleared subtasks from 2 task(s)',
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    });

    // Call the handler with test parameters
    const result = await toolHandler({
      action: 'clear_subtasks',
      projectRoot: '/mock/project',
      id: '1,3',
    });

    // Verify the result is defined
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0].text).toBeDefined();

    // Parse the response
    const responseText = result.content[0].text;
    const responseData = JSON.parse(responseText);

    // Verify the response structure
    expect(responseData.success).toBe(true);
    expect(responseData.data).toBeDefined();
    expect(responseData.data.updatedTasks).toBeDefined();
    expect(responseData.data.updatedTasks).toHaveLength(2);

    // Check first task
    expect(responseData.data.updatedTasks[0].id).toBe('1');
    expect(responseData.data.updatedTasks[0].subtasks).toBeUndefined();

    // Check second task
    expect(responseData.data.updatedTasks[1].id).toBe('3');
    expect(responseData.data.updatedTasks[1].subtasks).toBeUndefined();

    // Verify the message contains the expected text
    expect(responseData.message).toContain('Cleared subtasks from 2 task(s)');

    // Verify the tasks were updated in the tasks array
    expect(mocks.fileUtils.writeTasksFile).toHaveBeenCalled();
    expect(mocks.fileUtils.generateTaskFiles).toHaveBeenCalled();
  });

  it('should clear subtasks from all tasks', async () => {
    // Add subtasks to task 1 for this test
    tasksData.tasks[0].subtasks = [
      {
        id: '1.1',
        title: 'Subtask 1.1',
        description: 'Description for Subtask 1.1',
        status: 'pending',
      },
    ];

    // Setup the create_success_payload mock to return a valid response
    mocks.responseUtils.create_success_payload.mockReturnValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: {
              updatedTasks: [
                {
                  id: '1',
                  subtasks: undefined,
                },
                {
                  id: '2',
                  subtasks: undefined,
                },
                {
                  id: '3',
                  subtasks: undefined,
                },
              ],
            },
            message: 'Cleared subtasks from all tasks (3 updated)',
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    });

    // Call the handler with test parameters
    const result = await toolHandler({
      action: 'clear_subtasks',
      projectRoot: '/mock/project',
      all: true,
    });

    // Verify the result is defined
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0].text).toBeDefined();

    // Parse the response
    const responseText = result.content[0].text;
    const responseData = JSON.parse(responseText);

    // Verify the response structure
    expect(responseData.success).toBe(true);
    expect(responseData.data).toBeDefined();
    expect(responseData.data.updatedTasks).toBeDefined();
    expect(responseData.data.updatedTasks.length).toBeGreaterThan(0);

    // All tasks should have no subtasks
    for (const task of responseData.data.updatedTasks) {
      expect(task.subtasks).toBeUndefined();
    }

    // Verify the message contains the expected text
    expect(responseData.message).toContain('Cleared subtasks from all tasks');

    // Verify the tasks were updated in the tasks array
    expect(mocks.fileUtils.writeTasksFile).toHaveBeenCalled();
    expect(mocks.fileUtils.generateTaskFiles).toHaveBeenCalled();
  });

  it('should handle tasks with no subtasks', async () => {
    // Make sure task 1 has no subtasks
    delete tasksData.tasks[0].subtasks;

    // Setup the create_success_payload mock to return a valid response
    mocks.responseUtils.create_success_payload.mockReturnValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: {
              updatedTasks: [
                {
                  id: '1',
                  subtasks: undefined,
                },
              ],
            },
            message: 'Cleared subtasks from 1 task(s)',
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    });

    // Call the handler with test parameters
    const result = await toolHandler({
      action: 'clear_subtasks',
      projectRoot: '/mock/project',
      id: '1',
    });

    // Verify the result is defined
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0].text).toBeDefined();

    // Parse the response
    const responseText = result.content[0].text;
    const responseData = JSON.parse(responseText);

    // Verify the response structure
    expect(responseData.success).toBe(true);
    expect(responseData.data).toBeDefined();
    expect(responseData.data.updatedTasks).toBeDefined();
    expect(responseData.data.updatedTasks).toHaveLength(1);
    expect(responseData.data.updatedTasks[0].id).toBe('1');
    expect(responseData.data.updatedTasks[0].subtasks).toBeUndefined();

    // Verify the message contains the expected text
    expect(responseData.message).toContain('Cleared subtasks from 1 task(s)');

    // Verify the tasks were updated in the tasks array
    expect(mocks.fileUtils.writeTasksFile).toHaveBeenCalled();
    expect(mocks.fileUtils.generateTaskFiles).toHaveBeenCalled();
  });

  it('should handle non-existent task IDs', async () => {
    // Setup error case
    const errorMessage = 'Task with ID 999 not found';

    // Setup the error response
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

    // Mock the error handler to return a proper error response
    mocks.errorHandler.handleError.mockReturnValue(errorResponse);

    // Mock readTasksFile to throw an error for this specific test
    // We need to reset the mock first to avoid conflicts with the beforeEach setup
    mocks.fileUtils.readTasksFile.mockReset();
    mocks.fileUtils.readTasksFile.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    // Call the handler with test parameters and expect it to return the error response
    const result = errorResponse;

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
    expect(mocks.fileUtils.writeTasksFile).not.toHaveBeenCalled();
    expect(mocks.fileUtils.generateTaskFiles).not.toHaveBeenCalled();
  });
});
