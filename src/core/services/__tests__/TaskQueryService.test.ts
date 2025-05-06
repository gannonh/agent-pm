import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskQueryService } from '../TaskQueryService.js';
import type { Task } from '../../../types/task.d.ts';
import type { ITaskRepository } from '../../interfaces/ITaskRepository.js';

describe('TaskQueryService', () => {
  let taskQueryService: TaskQueryService;
  let mockRepository: ITaskRepository;
  let mockTasks: Task[];

  beforeEach(() => {
    // Create mock tasks
    mockTasks = [
      {
        id: '1',
        title: 'Task 1',
        description: 'First task',
        status: 'pending',
        priority: 'high',
        dependencies: [],
      },
      {
        id: '2',
        title: 'Task 2',
        description: 'Second task',
        status: 'in-progress',
        priority: 'medium',
        dependencies: ['1'],
      },
      {
        id: '3',
        title: 'Task 3',
        description: 'Third task',
        status: 'done',
        priority: 'low',
        dependencies: ['1', '2'],
        subtasks: [
          {
            id: '3.1',
            title: 'Subtask 3.1',
            description: 'First subtask of Task 3',
            status: 'done',
            dependencies: [],
          },
        ],
      },
      {
        id: '4',
        title: 'Important task',
        description: 'Fourth task',
        status: 'pending',
        priority: 'high',
        dependencies: [],
      },
    ];

    // Create mock repository
    mockRepository = {
      getAllTasks: vi.fn().mockReturnValue(mockTasks),
      getTask: vi.fn((id) => mockTasks.find((task) => task.id === id) || undefined),
      addTask: vi.fn(),
      updateTask: vi.fn(),
      deleteTask: vi.fn(),
      hasTask: vi.fn(),
      clear: vi.fn(),
    };

    // Create task query service
    taskQueryService = new TaskQueryService(mockRepository);
  });

  describe('filterTasks', () => {
    it('should filter tasks by status', () => {
      const pendingTasks = taskQueryService.filterTasks({ status: 'pending' });
      expect(pendingTasks).toHaveLength(2);
      expect(pendingTasks[0].id).toBe('1');
      expect(pendingTasks[1].id).toBe('4');

      const inProgressTasks = taskQueryService.filterTasks({ status: 'in-progress' });
      expect(inProgressTasks).toHaveLength(1);
      expect(inProgressTasks[0].id).toBe('2');

      const doneTasks = taskQueryService.filterTasks({ status: 'done' });
      expect(doneTasks).toHaveLength(1);
      expect(doneTasks[0].id).toBe('3');
    });

    it('should filter tasks by priority', () => {
      const highPriorityTasks = taskQueryService.filterTasks({ priority: 'high' });
      expect(highPriorityTasks).toHaveLength(2);
      expect(highPriorityTasks[0].id).toBe('1');
      expect(highPriorityTasks[1].id).toBe('4');

      const mediumPriorityTasks = taskQueryService.filterTasks({ priority: 'medium' });
      expect(mediumPriorityTasks).toHaveLength(1);
      expect(mediumPriorityTasks[0].id).toBe('2');

      const lowPriorityTasks = taskQueryService.filterTasks({ priority: 'low' });
      expect(lowPriorityTasks).toHaveLength(1);
      expect(lowPriorityTasks[0].id).toBe('3');
    });

    it('should filter tasks by title', () => {
      const tasksWithTitle = taskQueryService.filterTasks({ title: 'Important' });
      expect(tasksWithTitle).toHaveLength(1);
      expect(tasksWithTitle[0].id).toBe('4');
    });

    it('should filter tasks by description', () => {
      const tasksWithDescription = taskQueryService.filterTasks({ description: 'First' });
      expect(tasksWithDescription).toHaveLength(1);
      expect(tasksWithDescription[0].id).toBe('1');
    });

    it('should filter tasks by dependency', () => {
      const tasksWithDependency = taskQueryService.filterTasks({ dependsOn: '1' });
      expect(tasksWithDependency).toHaveLength(2);
      expect(tasksWithDependency[0].id).toBe('2');
      expect(tasksWithDependency[1].id).toBe('3');
    });

    it('should filter tasks by having dependencies', () => {
      const tasksWithDependencies = taskQueryService.filterTasks({ hasDependencies: true });
      expect(tasksWithDependencies).toHaveLength(2);
      expect(tasksWithDependencies[0].id).toBe('2');
      expect(tasksWithDependencies[1].id).toBe('3');

      const tasksWithoutDependencies = taskQueryService.filterTasks({ hasDependencies: false });
      expect(tasksWithoutDependencies).toHaveLength(2);
      expect(tasksWithoutDependencies[0].id).toBe('1');
      expect(tasksWithoutDependencies[1].id).toBe('4');
    });

    it('should filter tasks by having subtasks', () => {
      const tasksWithSubtasks = taskQueryService.filterTasks({ hasSubtasks: true });
      expect(tasksWithSubtasks).toHaveLength(1);
      expect(tasksWithSubtasks[0].id).toBe('3');

      const tasksWithoutSubtasks = taskQueryService.filterTasks({ hasSubtasks: false });
      expect(tasksWithoutSubtasks).toHaveLength(3);
      expect(tasksWithoutSubtasks[0].id).toBe('1');
      expect(tasksWithoutSubtasks[1].id).toBe('2');
      expect(tasksWithoutSubtasks[2].id).toBe('4');
    });

    it('should combine multiple filters', () => {
      const filteredTasks = taskQueryService.filterTasks({
        status: 'pending',
        priority: 'high',
      });
      expect(filteredTasks).toHaveLength(2);
      expect(filteredTasks[0].id).toBe('1');
      expect(filteredTasks[1].id).toBe('4');

      const moreFilteredTasks = taskQueryService.filterTasks({
        status: 'pending',
        priority: 'high',
        hasDependencies: false,
      });
      expect(moreFilteredTasks).toHaveLength(2);
      expect(moreFilteredTasks[0].id).toBe('1');
      expect(moreFilteredTasks[1].id).toBe('4');
    });
  });

  describe('queryTasks', () => {
    it('should query tasks with no options', () => {
      const result = taskQueryService.queryTasks({});
      expect(result.tasks).toHaveLength(4);
      expect(result.total).toBe(4);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(4);
      expect(result.totalPages).toBe(1);
    });

    it('should query tasks with filter', () => {
      const result = taskQueryService.queryTasks({
        filter: { status: 'pending' },
      });
      expect(result.tasks).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(2);
      expect(result.totalPages).toBe(1);
    });

    it('should query tasks with sort', () => {
      const result = taskQueryService.queryTasks({
        sort: { field: 'priority', direction: 'asc' },
      });
      expect(result.tasks).toHaveLength(4);
      expect(result.tasks[0].priority).toBe('high');
      expect(result.tasks[1].priority).toBe('high');
      expect(result.tasks[2].priority).toBe('medium');
      expect(result.tasks[3].priority).toBe('low');
    });

    it('should query tasks with pagination', () => {
      const result = taskQueryService.queryTasks({
        pagination: { page: 1, pageSize: 2 },
      });
      expect(result.tasks).toHaveLength(2);
      expect(result.total).toBe(4);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(2);
      expect(result.totalPages).toBe(2);

      const page2Result = taskQueryService.queryTasks({
        pagination: { page: 2, pageSize: 2 },
      });
      expect(page2Result.tasks).toHaveLength(2);
      expect(page2Result.total).toBe(4);
      expect(page2Result.page).toBe(2);
      expect(page2Result.pageSize).toBe(2);
      expect(page2Result.totalPages).toBe(2);
    });

    it('should query tasks with filter, sort, and pagination', () => {
      const result = taskQueryService.queryTasks({
        filter: { status: 'pending' },
        sort: { field: 'title', direction: 'desc' },
        pagination: { page: 1, pageSize: 1 },
      });
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].title).toBe('Task 1');
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(1);
      expect(result.totalPages).toBe(2);
    });
  });

  describe('sortTasks', () => {
    it('should sort tasks by id', () => {
      const result = taskQueryService.queryTasks({
        sort: { field: 'id', direction: 'asc' },
      });
      expect(result.tasks[0].id).toBe('1');
      expect(result.tasks[1].id).toBe('2');
      expect(result.tasks[2].id).toBe('3');
      expect(result.tasks[3].id).toBe('4');

      const descResult = taskQueryService.queryTasks({
        sort: { field: 'id', direction: 'desc' },
      });
      expect(descResult.tasks[0].id).toBe('4');
      expect(descResult.tasks[1].id).toBe('3');
      expect(descResult.tasks[2].id).toBe('2');
      expect(descResult.tasks[3].id).toBe('1');
    });

    it('should sort tasks by title', () => {
      const result = taskQueryService.queryTasks({
        sort: { field: 'title', direction: 'asc' },
      });
      expect(result.tasks[0].title).toBe('Important task');
      expect(result.tasks[1].title).toBe('Task 1');
      expect(result.tasks[2].title).toBe('Task 2');
      expect(result.tasks[3].title).toBe('Task 3');
    });

    it('should sort tasks by description', () => {
      const result = taskQueryService.queryTasks({
        sort: { field: 'description', direction: 'asc' },
      });
      expect(result.tasks[0].description).toBe('First task');
      expect(result.tasks[1].description).toBe('Fourth task');
      expect(result.tasks[2].description).toBe('Second task');
      expect(result.tasks[3].description).toBe('Third task');
    });

    it('should sort tasks by status', () => {
      const result = taskQueryService.queryTasks({
        sort: { field: 'status', direction: 'asc' },
      });
      expect(result.tasks[0].status).toBe('done');
      expect(result.tasks[1].status).toBe('in-progress');
      expect(result.tasks[2].status).toBe('pending');
      expect(result.tasks[3].status).toBe('pending');
    });

    it('should sort tasks by priority', () => {
      const result = taskQueryService.queryTasks({
        sort: { field: 'priority', direction: 'asc' },
      });
      expect(result.tasks[0].priority).toBe('high');
      expect(result.tasks[1].priority).toBe('high');
      expect(result.tasks[2].priority).toBe('medium');
      expect(result.tasks[3].priority).toBe('low');
    });

    it('should sort tasks by dependencies', () => {
      const result = taskQueryService.queryTasks({
        sort: { field: 'dependencies', direction: 'asc' },
      });
      expect(result.tasks[0].dependencies.length).toBe(0);
      expect(result.tasks[1].dependencies.length).toBe(0);
      expect(result.tasks[2].dependencies.length).toBe(1);
      expect(result.tasks[3].dependencies.length).toBe(2);

      const descResult = taskQueryService.queryTasks({
        sort: { field: 'dependencies', direction: 'desc' },
      });
      expect(descResult.tasks[0].dependencies.length).toBe(2);
      expect(descResult.tasks[1].dependencies.length).toBe(1);
      expect(descResult.tasks[2].dependencies.length).toBe(0);
      expect(descResult.tasks[3].dependencies.length).toBe(0);
    });
  });

  describe('getTasksByStatus', () => {
    it('should return all tasks when no status is provided', () => {
      const tasks = taskQueryService.getTasksByStatus();
      expect(tasks).toHaveLength(4);
    });

    it('should return tasks with the specified status', () => {
      const pendingTasks = taskQueryService.getTasksByStatus('pending');
      expect(pendingTasks).toHaveLength(2);
      expect(pendingTasks[0].status).toBe('pending');
      expect(pendingTasks[1].status).toBe('pending');

      const inProgressTasks = taskQueryService.getTasksByStatus('in-progress');
      expect(inProgressTasks).toHaveLength(1);
      expect(inProgressTasks[0].status).toBe('in-progress');

      const doneTasks = taskQueryService.getTasksByStatus('done');
      expect(doneTasks).toHaveLength(1);
      expect(doneTasks[0].status).toBe('done');
    });
  });

  describe('getPendingTasks', () => {
    it('should return tasks with pending status', () => {
      const pendingTasks = taskQueryService.getPendingTasks();
      expect(pendingTasks).toHaveLength(2);
      expect(pendingTasks[0].status).toBe('pending');
      expect(pendingTasks[1].status).toBe('pending');
    });
  });

  describe('getCompletedTasks', () => {
    it('should return tasks with done status', () => {
      const completedTasks = taskQueryService.getCompletedTasks();
      expect(completedTasks).toHaveLength(1);
      expect(completedTasks[0].status).toBe('done');
    });
  });

  describe('getInProgressTasks', () => {
    it('should return tasks with in-progress status', () => {
      const inProgressTasks = taskQueryService.getInProgressTasks();
      expect(inProgressTasks).toHaveLength(1);
      expect(inProgressTasks[0].status).toBe('in-progress');
    });
  });

  describe('getHighPriorityTasks', () => {
    it('should return tasks with high priority', () => {
      const highPriorityTasks = taskQueryService.getHighPriorityTasks();
      expect(highPriorityTasks).toHaveLength(2);
      expect(highPriorityTasks[0].priority).toBe('high');
      expect(highPriorityTasks[1].priority).toBe('high');
    });
  });

  describe('getIndependentTasks', () => {
    it('should return tasks with no dependencies', () => {
      const independentTasks = taskQueryService.getIndependentTasks();
      expect(independentTasks).toHaveLength(2);
      expect(independentTasks[0].dependencies).toHaveLength(0);
      expect(independentTasks[1].dependencies).toHaveLength(0);
    });
  });

  describe('getReadyTasks', () => {
    it('should return pending tasks with all dependencies completed', () => {
      // Initially, only tasks with no dependencies are ready
      const readyTasks = taskQueryService.getReadyTasks();
      expect(readyTasks).toHaveLength(2);
      expect(readyTasks.map((t) => t.id).sort()).toEqual(['1', '4']);

      // Update task 1 to be done
      mockTasks[0].status = 'done';

      // Now task 2 should also be ready
      const updatedReadyTasks = taskQueryService.getReadyTasks();
      expect(updatedReadyTasks).toHaveLength(1);
      expect(updatedReadyTasks[0].id).toBe('4');

      // Update task 2 to be done
      mockTasks[1].status = 'done';

      // Task 3 is already done, so it shouldn't be in the ready tasks
      const finalReadyTasks = taskQueryService.getReadyTasks();
      expect(finalReadyTasks).toHaveLength(1);
      expect(finalReadyTasks[0].id).toBe('4');
    });

    it('should handle missing dependencies gracefully', () => {
      // Mock the repository.getTask to return undefined for non-existent dependencies
      mockRepository.getTask = vi.fn((id) => {
        if (id === '999') return undefined;
        return mockTasks.find((task) => task.id === id) || undefined;
      });

      // Add a task with a non-existent dependency
      mockTasks.push({
        id: '5',
        title: 'Task 5',
        description: 'Fifth task',
        status: 'pending',
        priority: 'medium',
        dependencies: ['999'], // Non-existent dependency
      });

      const readyTasks = taskQueryService.getReadyTasks();
      // The task with the non-existent dependency should be ready since the dependency is filtered out
      expect(readyTasks.some((task) => task.id === '5')).toBe(true);
      // Tasks 1 and 4 should still be ready
      expect(readyTasks.some((task) => task.id === '1')).toBe(true);
      expect(readyTasks.some((task) => task.id === '4')).toBe(true);
    });
  });
});
