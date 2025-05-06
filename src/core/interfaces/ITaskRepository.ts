import type { Task } from '../../types/task.d.ts';

/**
 * Interface for task repository operations
 */
export interface ITaskRepository {
  /**
   * Get a task by ID
   * @param id Task ID
   * @returns The task, or undefined if not found
   */
  getTask(id: string): Task | undefined;

  /**
   * Get all tasks
   * @returns Array of all tasks
   */
  getAllTasks(): Task[];

  /**
   * Add a task to the repository
   * @param task Task to add
   */
  addTask(task: Task): void;

  /**
   * Update a task in the repository
   * @param id Task ID
   * @param task Updated task
   * @throws Error if the task does not exist
   */
  updateTask(id: string, task: Task): void;

  /**
   * Delete a task from the repository
   * @param id Task ID
   * @returns True if the task was deleted, false if it didn't exist
   */
  deleteTask(id: string): boolean;

  /**
   * Check if a task exists in the repository
   * @param id Task ID
   * @returns True if the task exists, false otherwise
   */
  hasTask(id: string): boolean;

  /**
   * Clear all tasks from the repository
   */
  clear(): void;
}
