import type { Task, TaskStatus } from '../../types/task.d.ts';
import { TaskFilterOptions, TaskQueryOptions, TaskQueryResult } from '../../types/utils.js';

/**
 * Interface for task query operations
 */
export interface ITaskQueryService {
  /**
   * Filter tasks based on criteria
   * @param filter Filter criteria
   * @returns Array of tasks that match the filter
   */
  filterTasks(filter: TaskFilterOptions): Task[];

  /**
   * Query tasks with advanced options
   * @param options Query options
   * @returns Query result with tasks and pagination info
   */
  queryTasks(options: TaskQueryOptions): TaskQueryResult;

  /**
   * Get tasks by status
   * @param status Status to filter by (optional)
   * @returns Array of tasks with the specified status, or all tasks if no status is provided
   */
  getTasksByStatus(status?: TaskStatus): Task[];

  /**
   * Get pending tasks
   * @returns Array of tasks with 'pending' status
   */
  getPendingTasks(): Task[];

  /**
   * Get completed tasks
   * @returns Array of tasks with 'done' status
   */
  getCompletedTasks(): Task[];

  /**
   * Get in-progress tasks
   * @returns Array of tasks with 'in-progress' status
   */
  getInProgressTasks(): Task[];

  /**
   * Get high priority tasks
   * @returns Array of tasks with 'high' priority
   */
  getHighPriorityTasks(): Task[];

  /**
   * Get tasks with no dependencies
   * @returns Array of tasks that don't depend on any other tasks
   */
  getIndependentTasks(): Task[];

  /**
   * Get tasks that are ready to work on (pending with all dependencies completed)
   * @returns Array of tasks that are ready to work on
   */
  getReadyTasks(): Task[];

  /**
   * Find the next task to work on based on dependencies, status, and priority
   * @param options Optional filtering options
   * @returns The next task to work on, or undefined if no suitable task is found
   */
  findNextTask(options?: { priority?: string; containsText?: string }): Task | undefined;

  /**
   * Get a task by ID, supporting both regular tasks and subtasks
   * @param id Task ID (can be in format 'parentId.subtaskId' for subtasks)
   * @param tasks Array of tasks to search in
   * @returns The task or subtask if found, undefined otherwise
   */
  getTaskById(id: string, tasks: Task[]): Task | undefined;

  /**
   * Get filtered tasks with optional status filtering and subtask handling
   * @param tasks Array of tasks to filter
   * @param options Filter options
   * @returns Filtered tasks
   */
  getFilteredTasks(tasks: Task[], options?: { status?: string; withSubtasks?: boolean }): Task[];
}
