import { describe, it, expect } from 'vitest';
import { Task, Subtask, TaskStatus, TaskPriority, TasksData } from '../../../types/task.js';
import {
  TaskSchema,
  SubtaskSchema,
  TasksDataSchema,
  TaskStatusSchema,
  TaskPrioritySchema,
} from '../../../types/validation.js';

describe('Task Types', () => {
  describe('TaskStatus', () => {
    it('should allow valid status values', () => {
      const validStatuses: TaskStatus[] = [
        'pending',
        'in-progress',
        'done',
        'deferred',
        'cancelled',
      ];

      validStatuses.forEach((status) => {
        // This is a type check that will fail if the type is not assignable
        const taskStatus: TaskStatus = status;
        expect(taskStatus).toBe(status);
      });
    });
  });

  describe('TaskPriority', () => {
    it('should allow valid priority values', () => {
      const validPriorities: TaskPriority[] = ['high', 'medium', 'low'];

      validPriorities.forEach((priority) => {
        // This is a type check that will fail if the type is not assignable
        const taskPriority: TaskPriority = priority;
        expect(taskPriority).toBe(priority);
      });
    });
  });

  describe('Task interface', () => {
    it('should create a valid task object', () => {
      const task: Task = {
        id: '1',
        title: 'Test Task',
        description: 'This is a test task',
        details: 'Detailed implementation notes',
        testStrategy: 'Test using unit tests',
        status: 'pending',
        priority: 'medium',
        dependencies: [],
      };

      expect(task).toHaveProperty('id', '1');
      expect(task).toHaveProperty('title', 'Test Task');
      expect(task).toHaveProperty('description', 'This is a test task');
      expect(task).toHaveProperty('details', 'Detailed implementation notes');
      expect(task).toHaveProperty('testStrategy', 'Test using unit tests');
      expect(task).toHaveProperty('status', 'pending');
      expect(task).toHaveProperty('priority', 'medium');
      expect(task).toHaveProperty('dependencies');
      expect(task.dependencies).toEqual([]);
    });

    it('should create a task with subtasks', () => {
      const task: Task = {
        id: '1',
        title: 'Parent Task',
        description: 'This is a parent task',
        status: 'pending',
        priority: 'high',
        dependencies: [],
        subtasks: [
          {
            id: '1.1',
            title: 'Subtask 1',
            description: 'This is subtask 1',
            status: 'pending',
            dependencies: [],
          },
          {
            id: '1.2',
            title: 'Subtask 2',
            description: 'This is subtask 2',
            status: 'pending',
            dependencies: ['1.1'],
          },
        ],
      };

      expect(task).toHaveProperty('subtasks');
      expect(task.subtasks).toHaveLength(2);
      expect(task.subtasks?.[0].id).toBe('1.1');
      expect(task.subtasks?.[1].id).toBe('1.2');
      expect(task.subtasks?.[1].dependencies).toContain('1.1');
    });
  });

  describe('TasksData interface', () => {
    it('should create a valid tasks data object', () => {
      const tasksData: TasksData = {
        tasks: [
          {
            id: '1',
            title: 'Task 1',
            description: 'This is task 1',
            status: 'pending',
            priority: 'high',
            dependencies: [],
          },
          {
            id: '2',
            title: 'Task 2',
            description: 'This is task 2',
            status: 'pending',
            priority: 'medium',
            dependencies: ['1'],
          },
        ],
        metadata: {
          version: '1.0.0',
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          projectName: 'Test Project',
          projectDescription: 'A test project',
        },
      };

      expect(tasksData).toHaveProperty('tasks');
      expect(tasksData.tasks).toHaveLength(2);
      expect(tasksData).toHaveProperty('metadata');
      expect(tasksData.metadata).toHaveProperty('version', '1.0.0');
      expect(tasksData.metadata).toHaveProperty('projectName', 'Test Project');
    });
  });
});

// Test Zod schemas for runtime validation
describe('Task Zod Schemas', () => {
  describe('TaskStatusSchema', () => {
    it('should validate valid status values', () => {
      const validStatuses: TaskStatus[] = [
        'pending',
        'in-progress',
        'done',
        'deferred',
        'cancelled',
      ];

      validStatuses.forEach((status) => {
        expect(TaskStatusSchema.parse(status)).toBe(status);
      });
    });

    it('should reject invalid status values', () => {
      expect(() => TaskStatusSchema.parse('invalid')).toThrow();
      expect(() => TaskStatusSchema.parse('')).toThrow();
      expect(() => TaskStatusSchema.parse(null)).toThrow();
    });
  });

  describe('TaskPrioritySchema', () => {
    it('should validate valid priority values', () => {
      const validPriorities: TaskPriority[] = ['high', 'medium', 'low'];

      validPriorities.forEach((priority) => {
        expect(TaskPrioritySchema.parse(priority)).toBe(priority);
      });
    });

    it('should reject invalid priority values', () => {
      expect(() => TaskPrioritySchema.parse('invalid')).toThrow();
      expect(() => TaskPrioritySchema.parse('')).toThrow();
      expect(() => TaskPrioritySchema.parse(null)).toThrow();
    });
  });

  describe('SubtaskSchema', () => {
    it('should validate a valid subtask', () => {
      const subtask: Subtask = {
        id: '1.1',
        title: 'Subtask 1',
        description: 'This is subtask 1',
        status: 'pending',
        dependencies: [],
      };

      const result = SubtaskSchema.parse(subtask);
      expect(result).toEqual(subtask);
    });

    it('should reject a subtask with invalid ID format', () => {
      const invalidSubtask = {
        id: 'invalid',
        title: 'Subtask 1',
        description: 'This is subtask 1',
        status: 'pending',
        dependencies: [],
      };

      expect(() => SubtaskSchema.parse(invalidSubtask)).toThrow();
    });

    it('should reject a subtask with missing required fields', () => {
      const incompleteSubtask = {
        id: '1.1',
        title: 'Subtask 1',
      };

      expect(() => SubtaskSchema.parse(incompleteSubtask)).toThrow();
    });
  });

  describe('TaskSchema', () => {
    it('should validate a valid task', () => {
      const task: Task = {
        id: '1',
        title: 'Test Task',
        description: 'This is a test task',
        status: 'pending',
        priority: 'medium',
        dependencies: [],
      };

      const result = TaskSchema.parse(task);
      expect(result).toEqual(task);
    });

    it('should validate a task with subtasks', () => {
      const task: Task = {
        id: '1',
        title: 'Parent Task',
        description: 'This is a parent task',
        status: 'pending',
        priority: 'high',
        dependencies: [],
        subtasks: [
          {
            id: '1.1',
            title: 'Subtask 1',
            description: 'This is subtask 1',
            status: 'pending',
            dependencies: [],
          },
        ],
      };

      const result = TaskSchema.parse(task);
      expect(result).toEqual(task);
    });

    it('should reject a task with missing required fields', () => {
      const incompleteTask = {
        id: '1',
        title: 'Test Task',
      };

      expect(() => TaskSchema.parse(incompleteTask)).toThrow();
    });
  });

  describe('TasksDataSchema', () => {
    it('should validate valid tasks data', () => {
      const tasksData: TasksData = {
        tasks: [
          {
            id: '1',
            title: 'Task 1',
            description: 'This is task 1',
            status: 'pending',
            priority: 'high',
            dependencies: [],
          },
        ],
        metadata: {
          version: '1.0.0',
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          projectName: 'Test Project',
        },
      };

      const result = TasksDataSchema.parse(tasksData);
      expect(result).toEqual(tasksData);
    });

    it('should reject tasks data with invalid metadata', () => {
      const invalidTasksData = {
        tasks: [
          {
            id: '1',
            title: 'Task 1',
            description: 'This is task 1',
            status: 'pending',
            priority: 'high',
            dependencies: [],
          },
        ],
        metadata: {
          version: '1.0.0',
          // Missing required fields
        },
      };

      expect(() => TasksDataSchema.parse(invalidTasksData)).toThrow();
    });
  });
});
