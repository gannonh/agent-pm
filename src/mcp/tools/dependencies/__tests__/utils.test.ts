/**
 * @fileoverview Tests for the dependencies utils
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sampleTasks } from './__helpers__/test-utils.js';
import { Task } from '../../../types/index.js';
import * as DependencyUtils from '../utils.js';

// Create hoisted mocks
const mocks = vi.hoisted(() => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../../utils/logger.js', () => ({
  logger: mocks.logger,
}));

describe('Dependencies Utils', () => {
  let tasks: Task[];
  let utils: typeof DependencyUtils;

  beforeEach(async () => {
    // Reset modules
    vi.resetModules();

    // Reset mocks
    vi.resetAllMocks();

    // Create a copy of sample tasks
    tasks = JSON.parse(JSON.stringify(sampleTasks));

    // Import the module under test
    utils = await import('../utils.js');
  });

  describe('findTaskById', () => {
    it('should find a task by ID', () => {
      const task = utils.findTaskById(tasks, '1');
      expect(task).toBeDefined();
      expect(task?.id).toBe('1');
      expect(task?.title).toBe('Task 1');
    });

    it('should find a task by numeric ID', () => {
      const task = utils.findTaskById(tasks, 2);
      expect(task).toBeDefined();
      expect(task?.id).toBe('2');
      expect(task?.title).toBe('Task 2');
    });

    it('should find a subtask by ID', () => {
      const subtask = utils.findTaskById(tasks, '3.1');
      expect(subtask).toBeDefined();
      expect(subtask?.id).toBe('1');
      expect(subtask?.title).toBe('Subtask 3.1');
    });

    it('should return undefined for non-existent task ID', () => {
      const task = utils.findTaskById(tasks, '999');
      expect(task).toBeUndefined();
    });

    it('should return undefined for non-existent subtask ID', () => {
      const subtask = utils.findTaskById(tasks, '3.999');
      expect(subtask).toBeUndefined();
    });

    it('should return undefined for non-existent parent task ID', () => {
      const subtask = utils.findTaskById(tasks, '999.1');
      expect(subtask).toBeUndefined();
    });
  });

  describe('validateDependencies', () => {
    it('should not throw for valid dependencies', () => {
      expect(() => utils.validateDependencies(tasks)).not.toThrow();
    });

    it('should throw for circular dependencies', () => {
      // Create a circular dependency: 1 -> 2 -> 3 -> 1
      tasks[0].dependencies = ['3'];

      expect(() => utils.validateDependencies(tasks)).toThrow('Circular dependency detected');
    });

    it('should throw for self-referencing dependencies', () => {
      // Create a self-referencing dependency: 1 -> 1
      tasks[0].dependencies = ['1'];

      expect(() => utils.validateDependencies(tasks)).toThrow('Circular dependency detected');
    });

    it('should handle circular dependencies in subtasks', () => {
      // Create a circular dependency in subtasks: 3.1 -> 3.2 -> 3.1
      const subtasks = tasks[2].subtasks;
      if (subtasks) {
        subtasks[0].dependencies = ['3.2'];

        expect(() => utils.validateDependencies(tasks)).toThrow('Circular dependency detected');
      } else {
        // This should never happen with our test data, but TypeScript needs this check
        throw new Error('Test setup error: subtasks is undefined');
      }
    });

    it('should handle complex circular dependencies', () => {
      // Create a complex circular dependency: 1 -> 2 -> 3 -> 3.1 -> 3.2 -> 1
      tasks[0].dependencies = ['3'];

      const subtasks = tasks[2].subtasks;
      if (subtasks) {
        subtasks[0].dependencies = ['3.2'];
        subtasks[1].dependencies = ['1'];

        expect(() => utils.validateDependencies(tasks)).toThrow('Circular dependency detected');
      } else {
        // This should never happen with our test data, but TypeScript needs this check
        throw new Error('Test setup error: subtasks is undefined');
      }
    });
  });

  describe('findDependentTasks', () => {
    it('should find tasks that depend on a given task', () => {
      const dependentTasks = utils.findDependentTasks(tasks, '1');
      expect(dependentTasks).toHaveLength(1);
      expect(dependentTasks[0]).toBe('2');
    });

    it('should find tasks that depend on a subtask', () => {
      const dependentTasks = utils.findDependentTasks(tasks, '3.1');
      expect(dependentTasks).toHaveLength(1);
      expect(dependentTasks[0]).toBe('3.2');
    });

    it('should return an empty array if no tasks depend on the given task', () => {
      const dependentTasks = utils.findDependentTasks(tasks, '3');
      expect(dependentTasks).toHaveLength(0);
    });

    it('should handle non-existent task IDs', () => {
      const dependentTasks = utils.findDependentTasks(tasks, '999');
      expect(dependentTasks).toHaveLength(0);
    });
  });
});
