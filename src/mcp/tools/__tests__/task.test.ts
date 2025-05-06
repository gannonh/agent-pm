import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTaskTool } from '../task.js';
import { Task } from '../../types/index.js';
import * as fileUtils from '../../utils/file-utils.js';
// No need to import task-utils as we're implementing the functionality directly
import { isErrorResponse } from '../../utils/__tests__/test-helpers.js';

// Mock dependencies
vi.mock('../../utils/file-utils.js', () => ({
  readTasksFile: vi.fn(),
  writeTasksFile: vi.fn(),
  generateTaskFiles: vi.fn(),
}));

// No need to mock task-utils as we're implementing the functionality directly

vi.mock('../../validation/index.js', () => ({
  validateParams: vi.fn((params) => params),
  getProjectRoot: vi.fn((root) => root || '/mock/project'),
  schemas: {
    projectRoot: { optional: () => ({ default: () => '' }) },
    file: { optional: () => ({ default: () => '' }) },
    taskId: { optional: () => ({ describe: () => ({}) }) },
    status: { describe: () => ({}) },
    taskPriority: { optional: () => ({ describe: () => ({}) }) },
    withSubtasks: { describe: () => ({}) },
    containsText: { describe: () => ({}) },
  },
}));

describe('task tool', () => {
  let server: McpServer;
  let toolHandler: (
    params: Record<string, unknown>
  ) => Promise<
    | { content: Array<{ type: string; text: string }> }
    | { content: Array<{ type: string; text: string }>; isError: boolean }
  >;
  let mockTasks: Task[];

  beforeEach(() => {
    vi.resetAllMocks();

    // Create mock tasks
    mockTasks = [
      {
        id: '1',
        title: 'Task 1',
        description: 'Description 1',
        status: 'pending',
        priority: 'high',
        dependencies: [],
      },
      {
        id: '2',
        title: 'Task 2',
        description: 'Description 2',
        status: 'in-progress',
        priority: 'medium',
        dependencies: ['1'],
      },
      {
        id: '3',
        title: 'Task 3',
        description: 'Description 3',
        status: 'done',
        priority: 'low',
        dependencies: ['2'],
        subtasks: [
          {
            id: '3.1',
            title: 'Subtask 3.1',
            description: 'Subtask Description 3.1',
            status: 'done',
            dependencies: [],
          },
        ],
      },
    ] as Task[];

    // Mock readTasksFile to return our mock tasks
    vi.mocked(fileUtils.readTasksFile).mockResolvedValue({
      tasks: mockTasks,
      metadata: {
        version: '1.0.0',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      },
    });

    // No need to mock findNextTask as we're implementing it directly

    // Create a mock server
    server = {
      tool: vi.fn((_name, _description, _schema, handler) => {
        toolHandler = handler;
      }),
    } as unknown as McpServer;

    // Register the tool
    registerTaskTool(server);
  });

  it('should register the task tool with the server', () => {
    expect(server.tool).toHaveBeenCalledWith(
      'apm_task',
      'Manage and query tasks in the project',
      expect.any(Object),
      expect.any(Function)
    );
  });

  describe('get_all action', () => {
    it('should return all tasks when no status filter is provided', async () => {
      const result = await toolHandler({
        action: 'get_all',
        projectRoot: '/mock/project',
      });

      // Parse the response
      const content = JSON.parse(result.content[0].text);

      // Verify the response
      expect(content.success).toBe(true);
      expect(content.data.tasks).toHaveLength(3);
      expect(content.data.filter).toBe('all');
      expect(content.message).toContain('Found 3 tasks across all statuses');
    });

    it('should filter tasks by status when status filter is provided', async () => {
      const result = await toolHandler({
        action: 'get_all',
        projectRoot: '/mock/project',
        status: 'pending',
      });

      // Parse the response
      const content = JSON.parse(result.content[0].text);

      // Verify the response
      expect(content.success).toBe(true);
      expect(content.data.tasks).toHaveLength(1);
      expect(content.data.tasks[0].id).toBe('1');
      expect(content.data.filter).toBe('pending');
      expect(content.message).toContain("Found 1 tasks with status 'pending'");
    });

    it('should include subtasks when withSubtasks is true', async () => {
      const result = await toolHandler({
        action: 'get_all',
        projectRoot: '/mock/project',
        withSubtasks: true,
      });

      // Parse the response
      const content = JSON.parse(result.content[0].text);

      // Verify the response
      expect(content.success).toBe(true);
      expect(content.data.tasks).toHaveLength(3);
      expect(content.data.tasks[2].subtasks).toBeDefined();
      expect(content.data.tasks[2].subtasks).toHaveLength(1);
    });

    it('should exclude subtasks when withSubtasks is false', async () => {
      const result = await toolHandler({
        action: 'get_all',
        projectRoot: '/mock/project',
        withSubtasks: false,
      });

      // Parse the response
      const content = JSON.parse(result.content[0].text);

      // Verify the response
      expect(content.success).toBe(true);
      expect(content.data.tasks).toHaveLength(3);
      expect(content.data.tasks[2].subtasks).toBeUndefined();
    });
  });

  describe('get_single action', () => {
    it('should return a specific task by ID', async () => {
      const result = await toolHandler({
        action: 'get_single',
        projectRoot: '/mock/project',
        id: '2',
      });

      // Parse the response
      const content = JSON.parse(result.content[0].text);

      // Verify the response
      expect(content.success).toBe(true);
      expect(content.data.task).toBeDefined();
      expect(content.data.task.id).toBe('2');
      expect(content.data.task.title).toBe('Task 2');
      expect(content.message).toContain('Found task: Task 2');
    });

    it('should return a specific subtask by ID', async () => {
      const result = await toolHandler({
        action: 'get_single',
        projectRoot: '/mock/project',
        id: '3.1',
      });

      // Parse the response
      const content = JSON.parse(result.content[0].text);

      // Verify the response
      expect(content.success).toBe(true);
      expect(content.data.task).toBeDefined();
      expect(content.data.task.id).toBe('3.1');
      expect(content.data.task.title).toBe('Subtask 3.1');
      expect(content.message).toContain('Found task: Subtask 3.1');
    });

    it('should return an error when task ID is not provided', async () => {
      try {
        await toolHandler({
          action: 'get_single',
          projectRoot: '/mock/project',
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        // Verify the error message
        expect(error.message).toContain('Task ID is required');
      }
    });

    it('should return an error when task is not found', async () => {
      try {
        await toolHandler({
          action: 'get_single',
          projectRoot: '/mock/project',
          id: '999',
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        // Verify the error message
        expect(error.message).toContain('Task with ID 999 not found');
      }
    });
  });

  describe('get_next action', () => {
    it('should return the next task to work on', async () => {
      const result = await toolHandler({
        action: 'get_next',
        projectRoot: '/mock/project',
      });

      // Parse the response
      const content = JSON.parse(result.content[0].text);

      // Verify the response
      expect(content.success).toBe(true);
      expect(content.data.nextTask).toBeDefined();
      expect(content.data.nextTask.id).toBe('1');
      expect(content.data.allTasks).toHaveLength(3);
      expect(content.message).toContain('Found next task: Task 1');

      // Verify that agent instructions are included
      expect(content.agentInstructions).toBeDefined();
      expect(content.agentInstructions).toContain('automatically mark the task as "in-progress"');
      expect(content.agentInstructions).toContain(`id: '1'`);
    });

    it('should filter tasks by priority', async () => {
      const result = await toolHandler({
        action: 'get_next',
        projectRoot: '/mock/project',
        priority: 'high',
      });

      // Parse the response
      const content = JSON.parse(result.content[0].text);

      // Verify the response
      expect(content.success).toBe(true);
      expect(content.data.nextTask).toBeDefined();
      if (content.data.nextTask) {
        expect(content.data.nextTask.priority).toBe('high');
      }
    });

    it('should filter tasks by text content', async () => {
      // Add a task with specific text content
      mockTasks.push({
        id: '4',
        title: 'Test specific content',
        description: 'This task contains test text',
        status: 'pending',
        priority: 'medium',
        dependencies: [],
      });

      const result = await toolHandler({
        action: 'get_next',
        projectRoot: '/mock/project',
        containsText: 'specific',
      });

      // Parse the response
      const content = JSON.parse(result.content[0].text);

      // Verify the response
      expect(content.success).toBe(true);
      if (content.data.nextTask) {
        expect(content.data.nextTask.title).toContain('specific');
        // Verify that agent instructions are included
        expect(content.agentInstructions).toBeDefined();
        expect(content.agentInstructions).toContain('automatically mark the task as "in-progress"');
      }
    });

    it('should not include agent instructions when no next task is found', async () => {
      // Mock a scenario where no tasks are available
      vi.mocked(fileUtils.readTasksFile).mockResolvedValueOnce({
        tasks: [
          {
            id: '1',
            title: 'Task 1',
            description: 'Description 1',
            status: 'done', // All tasks are done
            priority: 'high',
            dependencies: [],
          },
        ],
        metadata: {
          version: '1.0.0',
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
        },
      });

      const result = await toolHandler({
        action: 'get_next',
        projectRoot: '/mock/project',
      });

      // Parse the response
      const content = JSON.parse(result.content[0].text);

      // Verify the response
      expect(content.success).toBe(true);
      expect(content.data.nextTask).toBeUndefined();
      expect(content.message).toContain('No ready tasks found');

      // Verify that agent instructions are not included
      expect(content.agentInstructions).toBeUndefined();
    });
  });

  describe('filter_by_status action', () => {
    it('should filter tasks by status', async () => {
      const result = await toolHandler({
        action: 'filter_by_status',
        projectRoot: '/mock/project',
        status: 'done',
      });

      // Parse the response
      const content = JSON.parse(result.content[0].text);

      // Verify the response
      expect(content.success).toBe(true);
      expect(content.data.tasks).toHaveLength(1);
      expect(content.data.tasks[0].id).toBe('3');
      expect(content.data.filter).toBe('done');
      expect(content.message).toContain("Found 1 tasks with status 'done'");
    });

    it('should return an error when status is not provided', async () => {
      try {
        await toolHandler({
          action: 'filter_by_status',
          projectRoot: '/mock/project',
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        // Verify the error message
        expect(error.message).toContain('Status is required');
      }
    });
  });

  describe('filter_by_priority action', () => {
    it('should filter tasks by priority', async () => {
      const result = await toolHandler({
        action: 'filter_by_priority',
        projectRoot: '/mock/project',
        priority: 'medium',
      });

      // Parse the response
      const content = JSON.parse(result.content[0].text);

      // Verify the response
      expect(content.success).toBe(true);
      expect(content.data.tasks).toHaveLength(1);
      expect(content.data.tasks[0].id).toBe('2');
      expect(content.data.filter).toBe('medium');
      expect(content.message).toContain("Found 1 tasks with priority 'medium'");
    });

    it('should return an error when priority is not provided', async () => {
      try {
        await toolHandler({
          action: 'filter_by_priority',
          projectRoot: '/mock/project',
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        // Verify the error message
        expect(error.message).toContain('Priority is required');
      }
    });
  });

  describe('error handling', () => {
    it('should handle invalid action', async () => {
      const result = await toolHandler({
        action: 'invalid_action',
        projectRoot: '/mock/project',
      });

      // Verify the response is an error
      expect(isErrorResponse(result)).toBe(true);

      // Parse the response to check the error message
      const content = JSON.parse(result.content[0].text);
      expect(content.data.error.message).toContain('Invalid action');
    });

    it('should handle file read errors', async () => {
      // Mock readTasksFile to throw an error
      vi.mocked(fileUtils.readTasksFile).mockRejectedValue(new Error('File read error'));

      const result = await toolHandler({
        action: 'get_all',
        projectRoot: '/mock/project',
      });

      // Verify the response is an error
      expect(isErrorResponse(result)).toBe(true);

      // Parse the response to check the error message
      const content = JSON.parse(result.content[0].text);
      expect(content.data.error.message).toContain('File read error');
    });
  });
});
