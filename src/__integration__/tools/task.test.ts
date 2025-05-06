import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import * as dotenv from 'dotenv';
import { registerTaskTool } from '../../../src/mcp/tools/task.js';
import { Task } from '../../mcp/types/index.js';

describe('apm_task integration tests', () => {
  const projectRoot = path.resolve(process.cwd(), 'test-project');
  const artifactsDir = path.join(projectRoot, 'apm-artifacts');
  const artifactsFile = path.join(artifactsDir, 'artifacts.json');
  let toolHandler: any;
  let mockTasks: Task[];

  // Setup before all tests
  beforeAll(async () => {
    // Load environment variables
    dotenv.config({ path: '.env.test' });

    // Create test directories
    await fs.mkdir(projectRoot, { recursive: true });
    await fs.mkdir(artifactsDir, { recursive: true });

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

    // Write mock tasks to artifacts.json
    await fs.writeFile(
      artifactsFile,
      JSON.stringify(
        {
          tasks: mockTasks,
          metadata: {
            version: '1.0.0',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
          },
        },
        null,
        2
      )
    );

    // Create a mock server
    const mockServer = {
      tool: (name: string, description: string, schema: any, handler: any) => {
        toolHandler = handler;
        return { handler };
      },
    };

    // Register the tool with the mock server
    registerTaskTool(mockServer as any);
  });

  // Cleanup after all tests
  afterAll(async () => {
    try {
      await fs.rm(projectRoot, { recursive: true, force: true });
    } catch (error) {
      console.error('Error cleaning up test project:', error);
    }
  });

  describe('get_all action', () => {
    it('should return all tasks', async () => {
      const result = await toolHandler({
        action: 'get_all',
        projectRoot,
      });

      // Parse the response
      const content = JSON.parse(result.content[0].text);

      // Verify the response
      expect(content.success).toBe(true);
      expect(content.data.tasks).toHaveLength(3);
      expect(content.data.filter).toBe('all');
      expect(content.message).toContain('Found 3 tasks across all statuses');
    });

    it('should filter tasks by status', async () => {
      const result = await toolHandler({
        action: 'get_all',
        projectRoot,
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
  });

  describe('get_single action', () => {
    it('should return a specific task by ID', async () => {
      const result = await toolHandler({
        action: 'get_single',
        projectRoot,
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
        projectRoot,
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
  });

  describe('get_next action', () => {
    it('should return the next task to work on', async () => {
      const result = await toolHandler({
        action: 'get_next',
        projectRoot,
      });

      // Parse the response
      const content = JSON.parse(result.content[0].text);

      // Verify the response
      expect(content.success).toBe(true);
      expect(content.data.nextTask).toBeDefined();
      expect(content.data.allTasks).toHaveLength(3);
    });
  });

  describe('filter_by_status action', () => {
    it('should filter tasks by status', async () => {
      const result = await toolHandler({
        action: 'filter_by_status',
        projectRoot,
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
  });

  describe('filter_by_priority action', () => {
    it('should filter tasks by priority', async () => {
      const result = await toolHandler({
        action: 'filter_by_priority',
        projectRoot,
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
  });
});
