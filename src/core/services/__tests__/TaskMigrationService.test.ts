import { describe, it, expect, beforeEach } from 'vitest';
import { TaskMigrationService } from '../TaskMigrationService.js';

describe('TaskMigrationService', () => {
  let taskMigrationService: TaskMigrationService;

  beforeEach(() => {
    taskMigrationService = new TaskMigrationService();
  });

  describe('needsDataMigration', () => {
    it('should return true for null or undefined data', () => {
      expect(taskMigrationService.needsDataMigration(null)).toBe(true);
      expect(taskMigrationService.needsDataMigration(undefined)).toBe(true);
    });

    it('should return true for non-object data', () => {
      expect(taskMigrationService.needsDataMigration('string')).toBe(true);
      expect(taskMigrationService.needsDataMigration(123)).toBe(true);
      expect(taskMigrationService.needsDataMigration(true)).toBe(true);
      expect(taskMigrationService.needsDataMigration([])).toBe(true);
    });

    it('should return true if tasks is not an array', () => {
      expect(
        taskMigrationService.needsDataMigration({
          tasks: 'not an array',
          metadata: {
            version: '1.0.0',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            projectName: 'Test Project',
          },
        })
      ).toBe(true);
    });

    it('should return true if metadata is missing or not an object', () => {
      expect(
        taskMigrationService.needsDataMigration({
          tasks: [],
        })
      ).toBe(true);

      expect(
        taskMigrationService.needsDataMigration({
          tasks: [],
          metadata: 'not an object',
        })
      ).toBe(true);
    });

    it('should return true if metadata is missing required fields', () => {
      expect(
        taskMigrationService.needsDataMigration({
          tasks: [],
          metadata: {
            // Missing version
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            projectName: 'Test Project',
          },
        })
      ).toBe(true);

      expect(
        taskMigrationService.needsDataMigration({
          tasks: [],
          metadata: {
            version: '1.0.0',
            // Missing created
            updated: new Date().toISOString(),
            projectName: 'Test Project',
          },
        })
      ).toBe(true);

      expect(
        taskMigrationService.needsDataMigration({
          tasks: [],
          metadata: {
            version: '1.0.0',
            created: new Date().toISOString(),
            // Missing updated
            projectName: 'Test Project',
          },
        })
      ).toBe(true);

      expect(
        taskMigrationService.needsDataMigration({
          tasks: [],
          metadata: {
            version: '1.0.0',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            // Missing projectName
          },
        })
      ).toBe(true);
    });

    it('should return true if metadata fields have incorrect types', () => {
      expect(
        taskMigrationService.needsDataMigration({
          tasks: [],
          metadata: {
            version: 123, // Should be string
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            projectName: 'Test Project',
          },
        })
      ).toBe(true);

      expect(
        taskMigrationService.needsDataMigration({
          tasks: [],
          metadata: {
            version: '1.0.0',
            created: 123, // Should be string
            updated: new Date().toISOString(),
            projectName: 'Test Project',
          },
        })
      ).toBe(true);

      expect(
        taskMigrationService.needsDataMigration({
          tasks: [],
          metadata: {
            version: '1.0.0',
            created: new Date().toISOString(),
            updated: 123, // Should be string
            projectName: 'Test Project',
          },
        })
      ).toBe(true);

      expect(
        taskMigrationService.needsDataMigration({
          tasks: [],
          metadata: {
            version: '1.0.0',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            projectName: 123, // Should be string
          },
        })
      ).toBe(true);
    });

    it('should return false for valid tasks data', () => {
      expect(
        taskMigrationService.needsDataMigration({
          tasks: [],
          metadata: {
            version: '1.0.0',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            projectName: 'Test Project',
          },
        })
      ).toBe(false);
    });
  });

  describe('migrateTasksData', () => {
    it('should create new tasks data for null or undefined data', () => {
      const result = taskMigrationService.migrateTasksData(null);
      expect(result).toEqual({
        tasks: [],
        metadata: {
          version: '1.0.0',
          created: expect.any(String),
          updated: expect.any(String),
          projectName: 'Task Master Project',
        },
      });
    });

    it('should create new tasks data for non-object data', () => {
      const result = taskMigrationService.migrateTasksData('string');
      expect(result).toEqual({
        tasks: [],
        metadata: {
          version: '1.0.0',
          created: expect.any(String),
          updated: expect.any(String),
          projectName: 'Task Master Project',
        },
      });
    });

    it('should migrate tasks data with missing fields', () => {
      const result = taskMigrationService.migrateTasksData({
        tasks: [
          {
            id: '1',
            title: 'Task 1',
            // Missing description
            status: 'pending',
            // Missing priority
            // Missing dependencies
          },
        ],
        // Missing metadata
      });

      expect(result).toEqual({
        tasks: [
          {
            id: '1',
            title: 'Task 1',
            description: 'No description provided',
            status: 'pending',
            priority: 'medium',
            dependencies: [],
          },
        ],
        metadata: {
          version: '1.0.0',
          created: expect.any(String),
          updated: expect.any(String),
          projectName: 'Task Master Project',
        },
      });
    });

    it('should migrate tasks data with all fields', () => {
      const tasksData = {
        tasks: [
          {
            id: '1',
            title: 'Task 1',
            description: 'Task 1 description',
            status: 'pending',
            priority: 'high',
            dependencies: ['2'],
            details: 'Task 1 details',
            testStrategy: 'Task 1 test strategy',
          },
          {
            id: '2',
            title: 'Task 2',
            description: 'Task 2 description',
            status: 'done',
            priority: 'low',
            dependencies: [],
            subtasks: [
              {
                id: '2.1',
                title: 'Subtask 2.1',
                description: 'Subtask 2.1 description',
                status: 'done',
                priority: 'medium',
                dependencies: [],
              },
            ],
          },
        ],
        metadata: {
          version: '0.9.0',
          created: '2023-01-01T00:00:00.000Z',
          updated: '2023-01-02T00:00:00.000Z',
          projectName: 'Test Project',
        },
      };

      const result = taskMigrationService.migrateTasksData(tasksData);

      expect(result).toEqual({
        tasks: [
          {
            id: '1',
            title: 'Task 1',
            description: 'Task 1 description',
            status: 'pending',
            priority: 'high',
            dependencies: ['2'],
            details: 'Task 1 details',
            testStrategy: 'Task 1 test strategy',
          },
          {
            id: '2',
            title: 'Task 2',
            description: 'Task 2 description',
            status: 'done',
            priority: 'low',
            dependencies: [],
            subtasks: [
              {
                id: '2.1',
                title: 'Subtask 2.1',
                description: 'Subtask 2.1 description',
                status: 'done',
                priority: 'medium',
                dependencies: [],
              },
            ],
          },
        ],
        metadata: {
          version: '1.0.0',
          created: '2023-01-01T00:00:00.000Z',
          updated: '2023-01-02T00:00:00.000Z',
          projectName: 'Test Project',
        },
      });
    });
  });

  describe('migrateTask', () => {
    it('should create a new task for null or undefined data', () => {
      const result = taskMigrationService.migrateTask(null);
      expect(result).toEqual({
        id: '1',
        title: 'Untitled Task',
        description: 'No description provided',
        status: 'pending',
        priority: 'medium',
        dependencies: [],
      });
    });

    it('should create a new task for non-object data', () => {
      const result = taskMigrationService.migrateTask('string');
      expect(result).toEqual({
        id: '1',
        title: 'Untitled Task',
        description: 'No description provided',
        status: 'pending',
        priority: 'medium',
        dependencies: [],
      });
    });

    it('should migrate a task with missing fields', () => {
      const result = taskMigrationService.migrateTask({
        id: '1',
        title: 'Task 1',
        // Missing description
        status: 'pending',
        // Missing priority
        // Missing dependencies
      });

      expect(result).toEqual({
        id: '1',
        title: 'Task 1',
        description: 'No description provided',
        status: 'pending',
        priority: 'medium',
        dependencies: [],
      });
    });

    it('should migrate a task with all fields', () => {
      const task = {
        id: '1',
        title: 'Task 1',
        description: 'Task 1 description',
        status: 'pending',
        priority: 'high',
        dependencies: ['2'],
        details: 'Task 1 details',
        testStrategy: 'Task 1 test strategy',
      };

      const result = taskMigrationService.migrateTask(task);

      expect(result).toEqual({
        id: '1',
        title: 'Task 1',
        description: 'Task 1 description',
        status: 'pending',
        priority: 'high',
        dependencies: ['2'],
        details: 'Task 1 details',
        testStrategy: 'Task 1 test strategy',
      });
    });

    it('should migrate a task with subtasks', () => {
      const task = {
        id: '1',
        title: 'Task 1',
        description: 'Task 1 description',
        status: 'pending',
        priority: 'high',
        dependencies: [],
        subtasks: [
          {
            id: '1.1',
            title: 'Subtask 1.1',
            description: 'Subtask 1.1 description',
            status: 'done',
            priority: 'medium',
            dependencies: [],
          },
          {
            // Missing id
            title: 'Subtask 1.2',
            // Missing description
            // Missing status
            // Missing priority
            // Missing dependencies
          },
        ],
      };

      const result = taskMigrationService.migrateTask(task);

      expect(result).toEqual({
        id: '1',
        title: 'Task 1',
        description: 'Task 1 description',
        status: 'pending',
        priority: 'high',
        dependencies: [],
        subtasks: [
          {
            id: '1.1',
            title: 'Subtask 1.1',
            description: 'Subtask 1.1 description',
            status: 'done',
            priority: 'medium',
            dependencies: [],
          },
          {
            id: '1',
            title: 'Subtask 1.2',
            description: 'No description provided',
            status: 'pending',
            priority: 'medium',
            dependencies: [],
          },
        ],
      });
    });

    it('should handle non-string dependencies', () => {
      const task = {
        id: '1',
        title: 'Task 1',
        description: 'Task 1 description',
        status: 'pending',
        priority: 'high',
        dependencies: [2, 3], // Numbers instead of strings
      };

      const result = taskMigrationService.migrateTask(task);

      expect(result).toEqual({
        id: '1',
        title: 'Task 1',
        description: 'Task 1 description',
        status: 'pending',
        priority: 'high',
        dependencies: ['2', '3'], // Should be converted to strings
      });
    });
  });
});
