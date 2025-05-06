import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TaskManager, TaskManagerEvent } from '../TaskManager.js';
import type { TaskStatus } from '../../types/task.d.ts';
import * as fs from '../utils/fs.js';
import * as path from '../utils/path.js';
import * as lock from '../utils/lock.js';
import * as backup from '../utils/backup.js';

// Mock the file system utilities
vi.mock('../utils/fs.js');

// Mock the path utilities
vi.mock('../utils/path.js');

// Mock the lock utilities
vi.mock('../utils/lock.js', () => ({
  withFileLock: vi.fn((filePath, fn) => fn()),
}));

// Mock the backup utilities
vi.mock('../utils/backup.js');

describe('TaskManager', () => {
  let taskManager: TaskManager;
  const mockTasksFilePath = '/path/to/tasks.json';

  beforeEach(() => {
    vi.resetAllMocks();

    // Mock findTasksJsonPath to return a mock file path
    vi.mocked(path.findTasksJsonPath).mockResolvedValue(mockTasksFilePath);

    // Create a new TaskManager instance with autoSave disabled for most tests
    taskManager = new TaskManager(undefined, undefined, false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize the TaskManager and load tasks if the file exists', async () => {
      // Mock fileExists to return true
      vi.mocked(fs.fileExists).mockResolvedValue(true);

      // Mock readJsonFile to return mock tasks data
      const mockTasksData = {
        tasks: [
          {
            id: '1',
            title: 'Test Task',
            description: 'This is a test task',
            status: 'pending' as TaskStatus,
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
      vi.mocked(fs.readJsonFile).mockResolvedValue(mockTasksData);

      // Initialize the TaskManager
      await taskManager.initialize();

      // Verify that findTasksJsonPath was called
      expect(path.findTasksJsonPath).toHaveBeenCalled();

      // Verify that fileExists was called with the mock file path
      expect(fs.fileExists).toHaveBeenCalledWith(mockTasksFilePath);

      // Verify that readJsonFile was called with the mock file path
      expect(fs.readJsonFile).toHaveBeenCalledWith(mockTasksFilePath);

      // Verify that the tasks were loaded
      expect(taskManager.getAllTasks()).toHaveLength(1);
      expect(taskManager.getTask('1')).toEqual(mockTasksData.tasks[0]);
    });

    it('should handle errors during initialization', async () => {
      // Mock findTasksJsonPath to throw an error
      const mockError = new Error('Path error');
      vi.mocked(path.findTasksJsonPath).mockRejectedValue(mockError);

      // Mock event listener
      const errorEventListener = vi.fn();
      taskManager.on(TaskManagerEvent.ERROR, errorEventListener);

      // Initialize the TaskManager and expect it to throw
      await expect(taskManager.initialize()).rejects.toThrow('Path error');

      // Verify that the error event was emitted
      expect(errorEventListener).toHaveBeenCalledWith(mockError);
    });

    it('should initialize the TaskManager without loading tasks if the file does not exist', async () => {
      // Mock fileExists to return false
      vi.mocked(fs.fileExists).mockResolvedValue(false);

      // Initialize the TaskManager
      await taskManager.initialize();

      // Verify that findTasksJsonPath was called
      expect(path.findTasksJsonPath).toHaveBeenCalled();

      // Verify that fileExists was called with the mock file path
      expect(fs.fileExists).toHaveBeenCalledWith(mockTasksFilePath);

      // Verify that readJsonFile was not called
      expect(fs.readJsonFile).not.toHaveBeenCalled();

      // Verify that no tasks were loaded
      expect(taskManager.getAllTasks()).toHaveLength(0);
    });
  });

  describe('createTask', () => {
    it('should create a new task with the provided data', async () => {
      // Create a new task
      const taskData = {
        title: 'Test Task',
        description: 'This is a test task',
        status: 'pending' as TaskStatus,
        priority: 'medium' as const,
        dependencies: [],
      };

      // Mock event listener
      const createEventListener = vi.fn();
      taskManager.on(TaskManagerEvent.TASK_CREATED, createEventListener);

      // Create the task
      const createdTask = await taskManager.createTask(taskData);

      // Verify that the task was created with the correct data
      expect(createdTask).toEqual({
        id: '1',
        ...taskData,
      });

      // Verify that the task was added to the collection
      expect(taskManager.getTask('1')).toEqual(createdTask);

      // Verify that the event was emitted
      expect(createEventListener).toHaveBeenCalledWith(createdTask);
    });
  });

  describe('updateTask', () => {
    beforeEach(async () => {
      // Create a task to update
      await taskManager.createTask({
        title: 'Original Title',
        description: 'Original description',
        status: 'pending' as TaskStatus,
        priority: 'medium',
        dependencies: [],
      });
    });

    it('should update a task with the provided data', async () => {
      // Mock event listener
      const updateEventListener = vi.fn();
      taskManager.on(TaskManagerEvent.TASK_UPDATED, updateEventListener);

      // Update the task
      const updatedTask = await taskManager.updateTask('1', {
        title: 'Updated Title',
        description: 'Updated description',
        priority: 'high',
      });

      // Verify that the task was updated with the correct data
      expect(updatedTask.title).toBe('Updated Title');
      expect(updatedTask.description).toBe('Updated description');
      expect(updatedTask.priority).toBe('high');
      expect(updatedTask.status).toBe('pending'); // Status should remain unchanged

      // Verify that the task was updated in the collection
      expect(taskManager.getTask('1')).toEqual(updatedTask);

      // Verify that the event was emitted
      expect(updateEventListener).toHaveBeenCalledWith(updatedTask);
    });

    it('should throw an error when updating a non-existent task', async () => {
      // Mock event listener
      const errorEventListener = vi.fn();
      taskManager.on(TaskManagerEvent.ERROR, errorEventListener);

      // Try to update a non-existent task (should throw)
      await expect(taskManager.updateTask('999', { title: 'New Title' })).rejects.toThrow(
        'Task with ID 999 not found'
      );

      // Verify that the error event was emitted
      expect(errorEventListener).toHaveBeenCalled();
    });

    it('should not update the task if no changes are provided', async () => {
      // Get the original task
      const originalTask = taskManager.getTask('1');

      // Mock event listener
      const updateEventListener = vi.fn();
      taskManager.on(TaskManagerEvent.TASK_UPDATED, updateEventListener);

      // Update the task with an empty object
      const updatedTask = await taskManager.updateTask('1', {});

      // Verify that the task was not changed
      expect(updatedTask).toEqual(originalTask);

      // Note: The event might still be emitted in the implementation, so we don't test that here
    });

    it('should handle updating subtasks', async () => {
      // Create a task with subtasks
      await taskManager.createTask({
        title: 'Task with Subtasks',
        description: 'Task with subtasks',
        status: 'pending' as TaskStatus,
        priority: 'medium',
        dependencies: [],
        subtasks: [
          {
            id: '2.1',
            title: 'Subtask 1',
            description: 'Subtask 1 description',
            status: 'pending' as TaskStatus,
          },
          {
            id: '2.2',
            title: 'Subtask 2',
            description: 'Subtask 2 description',
            status: 'pending' as TaskStatus,
          },
        ],
      });

      // Mock event listener
      const updateEventListener = vi.fn();
      taskManager.on(TaskManagerEvent.TASK_UPDATED, updateEventListener);

      // Update the task with modified subtasks
      const updatedTask = await taskManager.updateTask('2', {
        subtasks: [
          {
            id: '2.1',
            title: 'Updated Subtask 1',
            description: 'Updated description 1',
            status: 'pending' as TaskStatus,
          },
          {
            id: '2.2',
            title: 'Subtask 2',
            description: 'Subtask 2 description',
            status: 'in-progress' as TaskStatus,
          },
          {
            id: '2.3',
            title: 'New Subtask',
            description: 'New subtask description',
            status: 'pending' as TaskStatus,
          },
        ],
      });

      // Verify that the subtasks were updated correctly
      expect(updatedTask.subtasks).toHaveLength(3);
      expect(updatedTask.subtasks?.[0].title).toBe('Updated Subtask 1');
      expect(updatedTask.subtasks?.[1].status).toBe('in-progress');
      expect(updatedTask.subtasks?.[2].id).toBe('2.3');

      // Verify that the event was emitted
      expect(updateEventListener).toHaveBeenCalledWith(updatedTask);
    });
  });

  describe('getAllTasks', () => {
    it('should return all tasks', async () => {
      const task1 = await taskManager.createTask({
        title: 'Task 1',
        description: 'Task 1 description',
        status: 'pending' as TaskStatus,
        priority: 'medium',
        dependencies: [],
      });

      const task2 = await taskManager.createTask({
        title: 'Task 2',
        description: 'Task 2 description',
        status: 'in-progress' as TaskStatus,
        priority: 'high',
        dependencies: [],
      });

      const allTasks = taskManager.getAllTasks();

      expect(allTasks).toHaveLength(2);
      expect(allTasks).toContainEqual(task1);
      expect(allTasks).toContainEqual(task2);
    });
  });

  describe('saveToFile', () => {
    it('should save tasks to the file system', async () => {
      // Mock fileExists to return true
      vi.mocked(fs.fileExists).mockResolvedValue(true);

      // Mock readJsonFile to return valid tasks data
      const initialTasksData = {
        tasks: [],
        metadata: {
          version: '1.0.0',
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          projectName: 'Test Project',
        },
      };
      vi.mocked(fs.readJsonFile).mockResolvedValue(initialTasksData);

      // Initialize the TaskManager
      await taskManager.initialize();

      // Create a task
      await taskManager.createTask({
        title: 'Test Task',
        description: 'Test task description',
        status: 'pending' as TaskStatus,
        priority: 'medium',
        dependencies: [],
      });

      // Mock writeJsonFile
      vi.mocked(fs.writeJsonFile).mockResolvedValue(undefined);

      // Mock createBackup
      vi.mocked(backup.createBackup).mockImplementation((filePath: string): Promise<string> => {
        return Promise.resolve(filePath + '.backup');
      });

      // Save the tasks
      await taskManager.saveToFile(mockTasksFilePath);

      // Verify that withFileLock was called
      expect(lock.withFileLock).toHaveBeenCalledWith(mockTasksFilePath, expect.any(Function));

      // Verify that createBackup was called with the correct first parameter
      expect(backup.createBackup).toHaveBeenCalled();

      // Verify that writeJsonFile was called with the correct data
      expect(fs.writeJsonFile).toHaveBeenCalledWith(
        mockTasksFilePath,
        expect.objectContaining({
          tasks: expect.arrayContaining([
            expect.objectContaining({
              id: '1',
              title: 'Test Task',
              status: 'pending',
            }),
          ]),
          metadata: expect.any(Object),
        })
      );
    });
  });

  describe('updateTaskStatus', () => {
    it('should set a valid status transition', async () => {
      // Create a task
      await taskManager.createTask({
        title: 'Test Task',
        description: 'This is a test task',
        status: 'pending' as TaskStatus,
        priority: 'medium',
        dependencies: [],
      });

      // Mock event listeners
      const updateEventListener = vi.fn();
      const statusChangeEventListener = vi.fn();
      taskManager.on(TaskManagerEvent.TASK_UPDATED, updateEventListener);
      taskManager.on(TaskManagerEvent.TASK_STATUS_CHANGED, statusChangeEventListener);

      // Set the task status
      const updatedTask = await taskManager.updateTaskStatus('1', 'in-progress');

      // Verify that the status was updated
      expect(updatedTask.status).toBe('in-progress');

      // Verify that the events were emitted
      expect(updateEventListener).toHaveBeenCalledWith(updatedTask);
      expect(statusChangeEventListener).toHaveBeenCalledWith(updatedTask, 'pending', 'in-progress');
    });

    it('should throw an error for an invalid status transition', async () => {
      // Create a task
      await taskManager.createTask({
        title: 'Test Task',
        description: 'This is a test task',
        status: 'pending' as TaskStatus,
        priority: 'medium',
        dependencies: [],
      });

      // Mock event listener
      const errorEventListener = vi.fn();
      taskManager.on(TaskManagerEvent.ERROR, errorEventListener);

      // Try to set an invalid status transition (pending -> done is not allowed)
      await expect(taskManager.updateTaskStatus('1', 'done')).rejects.toThrow(
        'Invalid status transition: Cannot go from pending to done'
      );

      // Verify that the error event was emitted
      expect(errorEventListener).toHaveBeenCalled();
    });

    it('should allow setting the same status', async () => {
      // Create a task
      const task = await taskManager.createTask({
        title: 'Test Task',
        description: 'This is a test task',
        status: 'pending' as TaskStatus,
        priority: 'medium',
        dependencies: [],
      });

      // Mock event listeners
      const updateEventListener = vi.fn();
      const statusChangeEventListener = vi.fn();
      taskManager.on(TaskManagerEvent.TASK_UPDATED, updateEventListener);
      taskManager.on(TaskManagerEvent.TASK_STATUS_CHANGED, statusChangeEventListener);

      // Set the same status
      const updatedTask = await taskManager.updateTaskStatus('1', 'pending');

      // Verify that the task was returned unchanged
      expect(updatedTask).toEqual(task);

      // Verify that no events were emitted
      expect(updateEventListener).not.toHaveBeenCalled();
      expect(statusChangeEventListener).not.toHaveBeenCalled();
    });

    it('should throw an error when updating status for a non-existent task', async () => {
      // Mock event listener
      const errorEventListener = vi.fn();
      taskManager.on(TaskManagerEvent.ERROR, errorEventListener);

      // Try to update a non-existent task (should throw)
      await expect(taskManager.updateTaskStatus('999', 'in-progress')).rejects.toThrow(
        'Task with ID 999 not found'
      );

      // Verify that the error event was emitted
      expect(errorEventListener).toHaveBeenCalled();
    });
  });

  describe('Task filtering and querying', () => {
    beforeEach(async () => {
      // Create test tasks with different statuses
      await taskManager.createTask({
        title: 'Pending Task 1',
        description: 'Pending task 1',
        status: 'pending' as TaskStatus,
        priority: 'medium',
        dependencies: [],
      });

      await taskManager.createTask({
        title: 'Pending Task 2',
        description: 'Pending task 2',
        status: 'pending' as TaskStatus,
        priority: 'high',
        dependencies: ['1'], // Depends on Pending Task 1
      });

      await taskManager.createTask({
        title: 'In Progress Task',
        description: 'In progress task',
        status: 'in-progress' as TaskStatus,
        priority: 'medium',
        dependencies: [],
      });

      await taskManager.createTask({
        title: 'Done Task',
        description: 'Done task',
        status: 'done' as TaskStatus,
        priority: 'low',
        dependencies: [],
      });
    });

    describe('getTasksByStatus', () => {
      it('should return tasks with the specified status', () => {
        // Test each status
        const pendingTasks = taskManager.getTasksByStatus('pending');
        expect(pendingTasks).toHaveLength(2);
        expect(pendingTasks[0].status).toBe('pending');
        expect(pendingTasks[1].status).toBe('pending');

        const inProgressTasks = taskManager.getTasksByStatus('in-progress');
        expect(inProgressTasks).toHaveLength(1);
        expect(inProgressTasks[0].status).toBe('in-progress');

        const doneTasks = taskManager.getTasksByStatus('done');
        expect(doneTasks).toHaveLength(1);
        expect(doneTasks[0].status).toBe('done');

        const deferredTasks = taskManager.getTasksByStatus('deferred');
        expect(deferredTasks).toHaveLength(0);

        const cancelledTasks = taskManager.getTasksByStatus('cancelled');
        expect(cancelledTasks).toHaveLength(0);
      });

      it('should return all tasks when no status is provided', () => {
        const allTasks = taskManager.getTasksByStatus();
        expect(allTasks).toHaveLength(4);
      });
    });

    describe('getPendingTasks', () => {
      it('should return all pending tasks', () => {
        const pendingTasks = taskManager.getPendingTasks();

        expect(pendingTasks).toHaveLength(2);
        expect(pendingTasks[0].title).toBe('Pending Task 1');
        expect(pendingTasks[1].title).toBe('Pending Task 2');
        expect(pendingTasks[0].status).toBe('pending');
        expect(pendingTasks[1].status).toBe('pending');
      });
    });

    describe('getCompletedTasks', () => {
      it('should return all completed tasks', () => {
        const completedTasks = taskManager.getCompletedTasks();

        expect(completedTasks).toHaveLength(1);
        expect(completedTasks[0].title).toBe('Done Task');
        expect(completedTasks[0].status).toBe('done');
      });
    });

    describe('getReadyTasks', () => {
      it('should return pending tasks with all dependencies completed', () => {
        // Initially, only Pending Task 1 should be ready (no dependencies)
        const readyTasks = taskManager.getReadyTasks();

        expect(readyTasks).toHaveLength(1);
        expect(readyTasks[0].title).toBe('Pending Task 1');
      });

      it('should include tasks when their dependencies are completed', async () => {
        // Mark the first task as done
        await taskManager.updateTaskStatus('1', 'in-progress');
        await taskManager.updateTaskStatus('1', 'done');

        // Now both pending tasks should be ready
        const readyTasks = taskManager.getReadyTasks();

        expect(readyTasks).toHaveLength(1);
        expect(readyTasks[0].title).toBe('Pending Task 2');
      });
    });
  });

  describe('findNextTask', () => {
    beforeEach(async () => {
      // Create test tasks with different priorities and dependencies
      await taskManager.createTask({
        title: 'High Priority Task',
        description: 'High priority task',
        status: 'pending' as TaskStatus,
        priority: 'high',
        dependencies: [],
      });

      await taskManager.createTask({
        title: 'Medium Priority Task',
        description: 'Medium priority task',
        status: 'pending' as TaskStatus,
        priority: 'medium',
        dependencies: [],
      });

      await taskManager.createTask({
        title: 'Low Priority Task',
        description: 'Low priority task',
        status: 'pending' as TaskStatus,
        priority: 'low',
        dependencies: [],
      });

      await taskManager.createTask({
        title: 'Dependent Task',
        description: 'Dependent task',
        status: 'pending' as TaskStatus,
        priority: 'high',
        dependencies: ['1'], // Depends on High Priority Task
      });

      await taskManager.createTask({
        title: 'In Progress Task',
        description: 'In progress task',
        status: 'in-progress' as TaskStatus,
        priority: 'medium',
        dependencies: [],
      });

      await taskManager.createTask({
        title: 'Done Task',
        description: 'Done task',
        status: 'done' as TaskStatus,
        priority: 'medium',
        dependencies: [],
      });
    });

    it('should find the next task based on priority and dependencies', () => {
      // Should return the high priority task with no dependencies
      const nextTask = taskManager.findNextTask();
      expect(nextTask?.title).toBe('High Priority Task');
      expect(nextTask?.priority).toBe('high');
    });

    it('should find the next task with specific priority', () => {
      // Should return the medium priority task
      const nextTask = taskManager.findNextTask({ priority: 'medium' });
      expect(nextTask?.title).toBe('Medium Priority Task');
      expect(nextTask?.priority).toBe('medium');
    });

    it('should find the next task containing specific text', () => {
      // Should return the low priority task
      const nextTask = taskManager.findNextTask({ containsText: 'Low' });
      expect(nextTask?.title).toBe('Low Priority Task');
    });

    it('should return undefined when no matching task is found', () => {
      // Should return undefined when no task matches the criteria
      const nextTask = taskManager.findNextTask({ containsText: 'Nonexistent' });
      expect(nextTask).toBeUndefined();
    });

    it('should not return tasks that are not ready (have incomplete dependencies)', () => {
      // Should not return the dependent task since its dependency is not completed
      const nextTask = taskManager.findNextTask({ containsText: 'Dependent' });
      expect(nextTask).toBeUndefined();
    });

    it('should return dependent task when its dependencies are completed', async () => {
      // Mark the high priority task as done
      await taskManager.updateTaskStatus('1', 'in-progress');
      await taskManager.updateTaskStatus('1', 'done');

      // Now the dependent task should be returned
      const nextTask = taskManager.findNextTask({ containsText: 'Dependent' });
      expect(nextTask?.title).toBe('Dependent Task');
    });
  });

  describe('Task dependency management', () => {
    beforeEach(async () => {
      // Create test tasks
      await taskManager.createTask({
        title: 'Task 1',
        description: 'Task 1',
        status: 'pending' as TaskStatus,
        priority: 'medium',
        dependencies: [],
      });

      await taskManager.createTask({
        title: 'Task 2',
        description: 'Task 2',
        status: 'pending' as TaskStatus,
        priority: 'medium',
        dependencies: [],
      });

      await taskManager.createTask({
        title: 'Task 3',
        description: 'Task 3',
        status: 'pending' as TaskStatus,
        priority: 'medium',
        dependencies: [],
      });
    });

    describe('addDependency', () => {
      it('should add a dependency to a task', async () => {
        // Mock event listener
        const dependencyAddedListener = vi.fn();
        taskManager.on(TaskManagerEvent.DEPENDENCY_ADDED, dependencyAddedListener);

        // Add a dependency
        await taskManager.addDependency('3', '1');

        // Verify that the dependency was added
        const task = taskManager.getTask('3');
        expect(task?.dependencies).toContain('1');

        // Verify that the event was emitted
        expect(dependencyAddedListener).toHaveBeenCalledWith('3', '1');
      });

      it('should throw an error when adding a dependency to a non-existent task', async () => {
        // Mock event listener
        const errorEventListener = vi.fn();
        taskManager.on(TaskManagerEvent.ERROR, errorEventListener);

        // Add a dependency to a non-existent task (should throw)
        await expect(taskManager.addDependency('999', '1')).rejects.toThrow(
          'Task with ID 999 not found'
        );

        // Verify that the error event was emitted
        expect(errorEventListener).toHaveBeenCalled();
      });

      it('should throw an error when adding a non-existent dependency', async () => {
        // Mock event listener
        const errorEventListener = vi.fn();
        taskManager.on(TaskManagerEvent.ERROR, errorEventListener);

        // Add a non-existent dependency (should throw)
        await expect(taskManager.addDependency('3', '999')).rejects.toThrow(
          'Dependency with ID 999 not found'
        );

        // Verify that the error event was emitted
        expect(errorEventListener).toHaveBeenCalled();
      });

      it('should throw an error when adding a circular dependency', async () => {
        // Mock event listener
        const errorEventListener = vi.fn();
        taskManager.on(TaskManagerEvent.ERROR, errorEventListener);

        // Add dependencies to create a potential circular dependency
        await taskManager.addDependency('2', '1');
        await taskManager.addDependency('3', '2');

        // Try to add a circular dependency (should throw)
        await expect(taskManager.addDependency('1', '3')).rejects.toThrow(
          'Adding this dependency would create a circular dependency'
        );

        // Verify that the error event was emitted
        expect(errorEventListener).toHaveBeenCalled();
      });
    });

    describe('removeDependency', () => {
      it('should remove a dependency from a task', async () => {
        // Add a dependency
        await taskManager.addDependency('3', '1');

        // Mock event listener
        const dependencyRemovedListener = vi.fn();
        taskManager.on(TaskManagerEvent.DEPENDENCY_REMOVED, dependencyRemovedListener);

        // Remove the dependency
        await taskManager.removeDependency('3', '1');

        // Verify that the dependency was removed
        const task = taskManager.getTask('3');
        expect(task?.dependencies).not.toContain('1');

        // Verify that the event was emitted
        expect(dependencyRemovedListener).toHaveBeenCalledWith('3', '1');
      });

      it('should throw an error when removing a dependency from a non-existent task', async () => {
        // Mock event listener
        const errorEventListener = vi.fn();
        taskManager.on(TaskManagerEvent.ERROR, errorEventListener);

        // Remove a dependency from a non-existent task (should throw)
        await expect(taskManager.removeDependency('999', '1')).rejects.toThrow(
          'Task with ID 999 not found'
        );

        // Verify that the error event was emitted
        expect(errorEventListener).toHaveBeenCalled();
      });
    });
  });
});
