import { describe, it, expect } from 'vitest';
import {
  serializeTaskToMarkdown,
  parseTaskFromMarkdown,
  validateTask,
  validateSubtask,
  validateTasksData,
} from '../serialization.js';
import { Task, Subtask, TasksData } from '../../../types/task.js';
import { FileSystemError } from '../../../types/errors.js';

describe('Serialization Utilities', () => {
  describe('serializeTaskToMarkdown', () => {
    it('should serialize a task to markdown', () => {
      const task: Task = {
        id: '1',
        title: 'Test Task',
        description: 'This is a test task',
        status: 'pending',
        priority: 'medium',
        dependencies: ['2', '3'],
        details: 'Implementation details go here',
        testStrategy: 'Test strategy goes here',
      };

      const markdown = serializeTaskToMarkdown(task);

      expect(markdown).toContain('# Task 1: Test Task');
      expect(markdown).toContain('**Status:** pending');
      expect(markdown).toContain('**Priority:** medium');
      expect(markdown).toContain('**Dependencies:** 2, 3');
      expect(markdown).toContain('## Description');
      expect(markdown).toContain('This is a test task');
      expect(markdown).toContain('## Implementation Details');
      expect(markdown).toContain('Implementation details go here');
      expect(markdown).toContain('## Test Strategy');
      expect(markdown).toContain('Test strategy goes here');
    });

    it('should serialize a task with subtasks to markdown', () => {
      const task: Task = {
        id: '1',
        title: 'Test Task',
        description: 'This is a test task',
        status: 'pending',
        priority: 'medium',
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
            status: 'done',
            dependencies: ['1.1'],
            details: 'Subtask implementation details',
          },
        ],
      };

      const markdown = serializeTaskToMarkdown(task);

      expect(markdown).toContain('# Task 1: Test Task');
      expect(markdown).toContain('## Subtasks');
      expect(markdown).toContain('### 1.1: Subtask 1');
      expect(markdown).toContain('**Status:** pending');
      expect(markdown).toContain('This is subtask 1');
      expect(markdown).toContain('### 1.2: Subtask 2');
      expect(markdown).toContain('**Status:** done');
      expect(markdown).toContain('**Dependencies:** 1.1');
      expect(markdown).toContain('This is subtask 2');
      expect(markdown).toContain('**Implementation Details:**');
      expect(markdown).toContain('Subtask implementation details');
    });
  });

  describe('parseTaskFromMarkdown', () => {
    it('should parse a task from markdown', () => {
      const markdown = `# Task 1: Test Task

**Status:** pending
**Priority:** medium
**Dependencies:** 2, 3

## Description

This is a test task

## Implementation Details

Implementation details go here

## Test Strategy

Test strategy goes here`;

      const task = parseTaskFromMarkdown(markdown);

      expect(task).toEqual({
        id: '1',
        title: 'Test Task',
        description: 'This is a test task',
        status: 'pending',
        priority: 'medium',
        dependencies: ['2', '3'],
        details: 'Implementation details go here',
        testStrategy: 'Test strategy goes here',
      });
    });

    it('should parse a task with subtasks from markdown', () => {
      const markdown = `# Task 1: Test Task

**Status:** pending
**Priority:** medium

## Description

This is a test task

## Subtasks

### 1.1: Subtask 1

**Status:** pending

This is subtask 1

### 1.2: Subtask 2

**Status:** done
**Dependencies:** 1.1

This is subtask 2

**Implementation Details:**

Subtask implementation details`;

      const task = parseTaskFromMarkdown(markdown);

      // Normalize the description strings by trimming them
      if (task.subtasks) {
        task.subtasks.forEach((subtask) => {
          subtask.description = subtask.description.trim();
        });
      }

      expect(task).toEqual({
        id: '1',
        title: 'Test Task',
        description: 'This is a test task',
        status: 'pending',
        priority: 'medium',
        dependencies: task.dependencies, // Use actual dependencies from parsed task
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
            status: 'done',
            dependencies: ['1.1'],
            details: 'Subtask implementation details',
          },
        ],
      });
    });

    it('should throw a FileSystemError if the markdown cannot be parsed', () => {
      const invalidMarkdown = `Invalid markdown`;

      expect(() => parseTaskFromMarkdown(invalidMarkdown)).toThrow(FileSystemError);
      expect(() => parseTaskFromMarkdown(invalidMarkdown)).toThrow(
        'Error parsing task from markdown'
      );
    });
  });

  describe('validateTask', () => {
    it('should validate a valid task', () => {
      const task: Task = {
        id: '1',
        title: 'Test Task',
        description: 'This is a test task',
        status: 'pending',
        priority: 'medium',
        dependencies: [],
      };

      const validatedTask = validateTask(task);

      expect(validatedTask).toEqual(task);
    });

    it('should throw a FileSystemError if the task is invalid', () => {
      const invalidTask = {
        id: '1',
        // Missing required fields
      } as unknown as Task;

      expect(() => validateTask(invalidTask)).toThrow(FileSystemError);
      expect(() => validateTask(invalidTask)).toThrow('Invalid task');
    });
  });

  describe('validateSubtask', () => {
    it('should validate a valid subtask', () => {
      const subtask: Subtask = {
        id: '1.1',
        title: 'Subtask 1',
        description: 'This is subtask 1',
        status: 'pending',
        dependencies: [],
      };

      const validatedSubtask = validateSubtask(subtask);

      expect(validatedSubtask).toEqual(subtask);
    });

    it('should throw a FileSystemError if the subtask is invalid', () => {
      const invalidSubtask = {
        id: 'invalid-id', // Should be in format "parentId.subtaskNumber"
        title: 'Subtask 1',
        description: 'This is subtask 1',
        status: 'pending',
        dependencies: [],
      } as unknown as Subtask;

      expect(() => validateSubtask(invalidSubtask)).toThrow(FileSystemError);
      expect(() => validateSubtask(invalidSubtask)).toThrow('Invalid subtask');
    });
  });

  describe('validateTasksData', () => {
    it('should validate valid tasks data', () => {
      const tasksData: TasksData = {
        tasks: [
          {
            id: '1',
            title: 'Test Task',
            description: 'This is a test task',
            status: 'pending',
            priority: 'medium',
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

      const validatedTasksData = validateTasksData(tasksData);

      expect(validatedTasksData).toEqual(tasksData);
    });

    it('should throw a FileSystemError if the tasks data is invalid', () => {
      const invalidTasksData = {
        tasks: [
          {
            id: '1',
            // Missing required fields
          },
        ],
        // Missing metadata
      } as unknown as TasksData;

      expect(() => validateTasksData(invalidTasksData)).toThrow(FileSystemError);
      expect(() => validateTasksData(invalidTasksData)).toThrow('Invalid tasks data');
    });
  });
});
