import type { Task, TaskStatus } from '../../types/task.d.ts';
import {
  TaskFilterOptions,
  TaskQueryOptions,
  TaskQueryResult,
  TaskSortOptions,
} from '../../types/utils.js';
import { ITaskQueryService } from '../interfaces/ITaskQueryService.js';
import { ITaskRepository } from '../interfaces/ITaskRepository.js';

/**
 * Implementation of the task query service
 */
export class TaskQueryService implements ITaskQueryService {
  private repository: ITaskRepository;

  /**
   * Create a new TaskQueryService
   * @param repository Task repository
   */
  constructor(repository: ITaskRepository) {
    this.repository = repository;
  }

  /**
   * Filter tasks based on criteria
   * @param filter Filter criteria
   * @returns Array of tasks that match the filter
   */
  filterTasks(filter: TaskFilterOptions): Task[] {
    // Get all tasks
    let tasks = this.repository.getAllTasks();

    // Filter by status
    if (filter.status) {
      tasks = tasks.filter((task) => task.status === filter.status);
    }

    // Filter by priority
    if (filter.priority) {
      tasks = tasks.filter((task) => task.priority === filter.priority);
    }

    // Filter by title
    if (filter.title) {
      const titleLower = filter.title.toLowerCase();
      tasks = tasks.filter((task) => task.title.toLowerCase().includes(titleLower));
    }

    // Filter by description
    if (filter.description) {
      const descLower = filter.description.toLowerCase();
      tasks = tasks.filter((task) => task.description.toLowerCase().includes(descLower));
    }

    // Filter by dependency
    if (filter.dependsOn) {
      tasks = tasks.filter((task) => task.dependencies.includes(filter.dependsOn!));
    }

    // Filter by having dependencies
    if (filter.hasDependencies !== undefined) {
      tasks = tasks.filter((task) =>
        filter.hasDependencies ? task.dependencies.length > 0 : task.dependencies.length === 0
      );
    }

    // Filter by having subtasks
    if (filter.hasSubtasks !== undefined) {
      tasks = tasks.filter((task) =>
        filter.hasSubtasks
          ? task.subtasks !== undefined && task.subtasks.length > 0
          : task.subtasks === undefined || task.subtasks.length === 0
      );
    }

    return tasks;
  }

  /**
   * Query tasks with advanced options
   * @param options Query options
   * @returns Query result with tasks and pagination info
   */
  queryTasks(options: TaskQueryOptions): TaskQueryResult {
    // Filter tasks
    let filteredTasks = this.filterTasks(options.filter || {});

    // Sort tasks
    if (options.sort) {
      filteredTasks = this.sortTasks(filteredTasks, options.sort);
    }

    // Calculate pagination values
    const total = filteredTasks.length;
    const page = options.pagination?.page || 1;
    const pageSize = options.pagination?.pageSize || total;
    const totalPages = Math.ceil(total / pageSize);

    // Apply pagination if provided
    let paginatedTasks = filteredTasks;
    if (options.pagination) {
      const startIndex = (page - 1) * pageSize;
      const endIndex = Math.min(startIndex + pageSize, total);
      paginatedTasks = filteredTasks.slice(startIndex, endIndex);
    }

    // Return the result
    return {
      tasks: paginatedTasks,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Sort tasks based on criteria
   * @param tasks Tasks to sort
   * @param sort Sort criteria
   * @returns Sorted tasks
   */
  private sortTasks(tasks: Task[], sort: TaskSortOptions): Task[] {
    return [...tasks].sort((a, b) => {
      // Sort by field
      const field = sort.field || 'id';
      const direction = sort.direction || 'asc';
      const multiplier = direction === 'asc' ? 1 : -1;

      // Handle different field types
      if (field === 'id') {
        return multiplier * (parseInt(a.id, 10) - parseInt(b.id, 10));
      } else if (field === 'title' || field === 'description') {
        return multiplier * a[field].localeCompare(b[field]);
      } else if (field === 'status') {
        return multiplier * a.status.localeCompare(b.status);
      } else if (field === 'priority') {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return multiplier * (priorityOrder[a.priority] - priorityOrder[b.priority]);
      } else if (field === 'dependencies') {
        return multiplier * (a.dependencies.length - b.dependencies.length);
      }

      return 0;
    });
  }

  /**
   * Get tasks by status
   * @param status Status to filter by (optional)
   * @returns Array of tasks with the specified status, or all tasks if no status is provided
   */
  getTasksByStatus(status?: TaskStatus): Task[] {
    if (!status) {
      return this.repository.getAllTasks();
    }
    return this.filterTasks({ status });
  }

  /**
   * Get pending tasks
   * @returns Array of tasks with 'pending' status
   */
  getPendingTasks(): Task[] {
    return this.filterTasks({ status: 'pending' });
  }

  /**
   * Get completed tasks
   * @returns Array of tasks with 'done' status
   */
  getCompletedTasks(): Task[] {
    return this.filterTasks({ status: 'done' });
  }

  /**
   * Get in-progress tasks
   * @returns Array of tasks with 'in-progress' status
   */
  getInProgressTasks(): Task[] {
    return this.filterTasks({ status: 'in-progress' });
  }

  /**
   * Get high priority tasks
   * @returns Array of tasks with 'high' priority
   */
  getHighPriorityTasks(): Task[] {
    return this.filterTasks({ priority: 'high' });
  }

  /**
   * Get tasks with no dependencies
   * @returns Array of tasks that don't depend on any other tasks
   */
  getIndependentTasks(): Task[] {
    return this.filterTasks({ hasDependencies: false });
  }

  /**
   * Get tasks that are ready to work on (pending with all dependencies completed)
   * @returns Array of tasks that are ready to work on
   */
  getReadyTasks(): Task[] {
    // Get all pending tasks
    const pendingTasks = this.getPendingTasks();

    // Filter to tasks where all dependencies are completed
    return pendingTasks.filter((task) => {
      // If the task has no dependencies, it's ready
      if (task.dependencies.length === 0) {
        return true;
      }

      // Check if all dependencies are completed
      const dependencies = task.dependencies
        .map((depId) => this.repository.getTask(depId))
        .filter(Boolean) as Task[];

      return dependencies.every((dep) => dep.status === 'done');
    });
  }

  /**
   * Find the next task to work on based on dependencies, status, and priority
   * @param options Optional filtering options
   * @returns The next task to work on, or undefined if no suitable task is found
   */
  findNextTask(options?: { priority?: string; containsText?: string }): Task | undefined {
    // Get all tasks
    const tasks = this.repository.getAllTasks();

    // Filter out completed tasks
    let availableTasks = tasks.filter((task) => task.status !== 'done');

    // Filter tasks by priority if specified
    if (options?.priority) {
      availableTasks = availableTasks.filter((task) => task.priority === options.priority);
    }

    // Filter tasks by text content if specified
    if (options?.containsText) {
      const searchText = options.containsText.toLowerCase();
      availableTasks = availableTasks.filter(
        (task) =>
          task.title.toLowerCase().includes(searchText) ||
          (task.description && task.description.toLowerCase().includes(searchText))
      );
    }

    // Filter tasks that have all dependencies satisfied
    const readyTasks = availableTasks.filter((task) => {
      // If the task has no dependencies, it's ready
      if (!task.dependencies || task.dependencies.length === 0) {
        return true;
      }

      // Check if all dependencies are completed
      return task.dependencies.every((depId) => {
        const dependency = tasks.find((t) => String(t.id) === String(depId));
        return dependency && dependency.status === 'done';
      });
    });

    // If no tasks are ready, return undefined
    if (readyTasks.length === 0) {
      return undefined;
    }

    // Sort tasks by priority (high > medium > low)
    const priorityOrder: Record<string, number> = {
      high: 0,
      medium: 1,
      low: 2,
      // Default priority if not specified
      undefined: 3,
    };

    const sortedTasks = [...readyTasks].sort((a, b) => {
      // First sort by priority
      const aPriority = a.priority || 'medium';
      const bPriority = b.priority || 'medium';
      const priorityDiff = priorityOrder[aPriority] - priorityOrder[bPriority];

      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      // If priorities are the same, sort by ID (assuming numeric IDs)
      return parseInt(String(a.id), 10) - parseInt(String(b.id), 10);
    });

    // Return the highest priority task
    return sortedTasks[0];
  }

  /**
   * Get a task by ID, supporting both regular tasks and subtasks
   * @param id Task ID (can be in format 'parentId.subtaskId' for subtasks)
   * @param tasks Array of tasks to search in
   * @returns The task or subtask if found, undefined otherwise
   */
  getTaskById(id: string, tasks: Task[]): Task | undefined {
    // Check if it's a subtask (format: parentId.subtaskId)
    if (id.includes('.')) {
      const [parentId, subtaskIndex] = id.split('.');

      // Find parent task - convert to string for comparison
      const parentTask = tasks.find((task) => String(task.id) === parentId);
      if (parentTask && parentTask.subtasks && parentTask.subtasks.length > 0) {
        // Try to get subtask by index (assuming 1-based indexing in the ID)
        const index = parseInt(subtaskIndex) - 1;
        if (index >= 0 && index < parentTask.subtasks.length) {
          // Convert subtask to Task type by adding required fields if missing
          const subtask = parentTask.subtasks[index];
          return {
            ...subtask,
            // Ensure required Task properties are present
            priority: (subtask as Partial<Task>).priority || parentTask.priority || 'medium',
            dependencies: subtask.dependencies || [],
          };
        }
      }
      return undefined;
    }

    // Find regular task - convert to string for comparison
    return tasks.find((task) => String(task.id) === id);
  }

  /**
   * Get filtered tasks with optional status filtering and subtask handling
   * @param tasks Array of tasks to filter
   * @param options Filter options
   * @returns Filtered tasks
   */
  getFilteredTasks(tasks: Task[], options?: { status?: string; withSubtasks?: boolean }): Task[] {
    // Start with a copy of the tasks array
    let filteredTasks = [...tasks];

    // Filter by status if provided
    if (options?.status) {
      filteredTasks = filteredTasks.filter((task) => task.status === options.status);
    }

    // Handle subtasks if needed
    if (options?.withSubtasks === false) {
      filteredTasks = filteredTasks.map((task) => {
        const { subtasks: _subtasks, ...rest } = task;
        return rest;
      }) as Task[];
    }

    return filteredTasks;
  }
}
