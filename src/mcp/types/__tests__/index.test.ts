import { describe, it, expect } from 'vitest';
import {
  ToolResponse,
  Task,
  TasksData,
  TaskSummary,
  createToolResponse,
  createTask,
  createTasksData,
  createTaskSummary,
} from '../index.js';

describe('MCP Types', () => {
  describe('ToolResponse', () => {
    it('should validate a success response', () => {
      const response: ToolResponse<string> = {
        success: true,
        message: 'Operation successful',
        data: 'Test data',
      };

      expect(response.success).toBe(true);
      expect(response.message).toBe('Operation successful');
      expect(response.data).toBe('Test data');
      expect(response.error).toBeUndefined();
    });

    it('should validate an error response', () => {
      const response: ToolResponse<null> = {
        success: false,
        message: 'Operation failed',
        error: 'Error details',
      };

      expect(response.success).toBe(false);
      expect(response.message).toBe('Operation failed');
      expect(response.data).toBeUndefined();
      expect(response.error).toBe('Error details');
    });

    it('should create a success response with createToolResponse', () => {
      const response = createToolResponse(true, 'Operation successful', 'Test data');

      expect(response.success).toBe(true);
      expect(response.message).toBe('Operation successful');
      expect(response.data).toBe('Test data');
      expect(response.error).toBeUndefined();
    });

    it('should create an error response with createToolResponse', () => {
      const response = createToolResponse(false, 'Operation failed', undefined, 'Error details');

      expect(response.success).toBe(false);
      expect(response.message).toBe('Operation failed');
      expect(response.data).toBeUndefined();
      expect(response.error).toBe('Error details');
    });
  });

  describe('Task', () => {
    it('should validate a basic task', () => {
      const task: Task = {
        id: '1',
        title: 'Test Task',
        status: 'pending',
      };

      expect(task.id).toBe('1');
      expect(task.title).toBe('Test Task');
      expect(task.status).toBe('pending');
    });

    it('should validate a task with all properties', () => {
      const task: Task = {
        id: '1',
        title: 'Test Task',
        status: 'pending',
        description: 'Test description',
        details: 'Test details',
        priority: 'high',
        dependencies: ['2', '3'],
        subtasks: [
          {
            id: '1.1',
            title: 'Subtask 1',
            status: 'pending',
          },
        ],
        customField: 'Custom value',
      };

      expect(task.id).toBe('1');
      expect(task.title).toBe('Test Task');
      expect(task.status).toBe('pending');
      expect(task.description).toBe('Test description');
      expect(task.details).toBe('Test details');
      expect(task.priority).toBe('high');
      expect(task.dependencies).toEqual(['2', '3']);
      expect(task.subtasks).toHaveLength(1);
      expect(task.subtasks?.[0].id).toBe('1.1');
      expect(task.customField).toBe('Custom value');
    });

    it('should create a task with createTask', () => {
      const task = createTask('1', 'Test Task', 'pending');

      expect(task.id).toBe('1');
      expect(task.title).toBe('Test Task');
      expect(task.status).toBe('pending');
    });
  });

  describe('TasksData', () => {
    it('should validate a basic tasks data object', () => {
      const tasksData: TasksData = {
        tasks: [
          {
            id: '1',
            title: 'Test Task',
            status: 'pending',
          },
        ],
      };

      expect(tasksData.tasks).toHaveLength(1);
      expect(tasksData.tasks[0].id).toBe('1');
    });

    it('should validate a tasks data object with metadata', () => {
      const tasksData: TasksData = {
        tasks: [
          {
            id: '1',
            title: 'Test Task',
            status: 'pending',
          },
        ],
        metadata: {
          projectName: 'Test Project',
          projectVersion: '1.0.0',
          createdAt: '2023-01-01',
          updatedAt: '2023-01-02',
          customField: 'Custom value',
        },
        customField: 'Custom value',
      };

      expect(tasksData.tasks).toHaveLength(1);
      expect(tasksData.metadata?.projectName).toBe('Test Project');
      expect(tasksData.metadata?.projectVersion).toBe('1.0.0');
      expect(tasksData.metadata?.createdAt).toBe('2023-01-01');
      expect(tasksData.metadata?.updatedAt).toBe('2023-01-02');
      expect(tasksData.metadata?.customField).toBe('Custom value');
      expect(tasksData.customField).toBe('Custom value');
    });

    it('should create a tasks data object with createTasksData', () => {
      const tasks = [
        {
          id: '1',
          title: 'Test Task',
          status: 'pending',
        },
      ];
      const tasksData = createTasksData(tasks);

      expect(tasksData.tasks).toEqual(tasks);
    });
  });

  describe('TaskSummary', () => {
    it('should validate a task summary object', () => {
      const summary: TaskSummary = {
        totalTasks: 10,
        completedTasks: 5,
        pendingTasks: 3,
        inProgressTasks: 2,
        taskCompletionPercentage: 50,
      };

      expect(summary.totalTasks).toBe(10);
      expect(summary.completedTasks).toBe(5);
      expect(summary.pendingTasks).toBe(3);
      expect(summary.inProgressTasks).toBe(2);
      expect(summary.taskCompletionPercentage).toBe(50);
    });

    it('should create a task summary with createTaskSummary', () => {
      const summary = createTaskSummary(10, 5, 3, 2);

      expect(summary.totalTasks).toBe(10);
      expect(summary.completedTasks).toBe(5);
      expect(summary.pendingTasks).toBe(3);
      expect(summary.inProgressTasks).toBe(2);
      expect(summary.taskCompletionPercentage).toBe(50);
    });

    it('should calculate task completion percentage correctly', () => {
      const summary1 = createTaskSummary(10, 5, 3, 2);
      expect(summary1.taskCompletionPercentage).toBe(50);

      const summary2 = createTaskSummary(10, 0, 8, 2);
      expect(summary2.taskCompletionPercentage).toBe(0);

      const summary3 = createTaskSummary(10, 10, 0, 0);
      expect(summary3.taskCompletionPercentage).toBe(100);

      const summary4 = createTaskSummary(0, 0, 0, 0);
      expect(summary4.taskCompletionPercentage).toBe(0);
    });
  });
});
