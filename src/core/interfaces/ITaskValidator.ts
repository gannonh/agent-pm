import type { Task, TaskStatus } from '../../types/task.d.ts';

/**
 * Interface for task validation operations
 */
export interface ITaskValidator {
  /**
   * Validate a task
   * @param task Task to validate
   * @returns Validated task
   * @throws Error if the task is invalid
   */
  validateTask(task: Task): Task;

  /**
   * Validate a status transition
   * @param currentStatus Current status
   * @param newStatus New status
   * @throws Error if the transition is not allowed
   */
  validateStatusTransition(currentStatus: TaskStatus, newStatus: TaskStatus): void;

  /**
   * Validate a task ID
   * @param id Task ID to validate
   * @returns True if the ID is valid, false otherwise
   */
  isValidTaskId(id: string): boolean;
}
