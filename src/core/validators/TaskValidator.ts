import type { Task, TaskStatus } from '../../types/task.d.ts';
import { TaskSchema } from '../../types/validation.js';
import { ITaskValidator } from '../interfaces/ITaskValidator.js';
import { FileSystemError, ErrorCode } from '../../types/errors.js';

/**
 * Valid statuses for tasks
 */
export const VALID_STATUSES: TaskStatus[] = [
  'pending',
  'in-progress',
  'done',
  'deferred',
  'cancelled',
];

/**
 * Valid status transitions map
 * Key: current status, Value: array of valid next statuses
 */
export const VALID_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ['in-progress', 'deferred', 'cancelled'],
  'in-progress': ['pending', 'done', 'cancelled'],
  done: ['in-progress'], // Can only reopen a completed task
  deferred: ['pending', 'cancelled'],
  cancelled: ['pending'], // Can only reactivate a cancelled task
};

/**
 * Implementation of the task validator
 */
export class TaskValidator implements ITaskValidator {
  /**
   * Validate a task
   * @param task Task to validate
   * @returns Validated task
   * @throws Error if the task is invalid
   */
  validateTask(task: Task): Task {
    try {
      return TaskSchema.parse(task);
    } catch (error) {
      throw new FileSystemError(
        `Invalid task data: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.INVALID_ARGUMENT
      );
    }
  }

  /**
   * Validate a status transition
   * @param currentStatus Current status
   * @param newStatus New status
   * @throws Error if the transition is not allowed
   */
  validateStatusTransition(currentStatus: TaskStatus, newStatus: TaskStatus): void {
    // Check if the status is valid
    if (!VALID_STATUSES.includes(newStatus)) {
      throw new FileSystemError(`Invalid status value: ${newStatus}`, ErrorCode.INVALID_ARGUMENT);
    }

    // If the status is not changing, it's always valid
    if (currentStatus === newStatus) {
      return;
    }

    // Check if the transition is allowed
    const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus];
    if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
      throw new FileSystemError(
        `Invalid status transition: Cannot go from ${currentStatus} to ${newStatus}`,
        ErrorCode.INVALID_STATUS_TRANSITION
      );
    }
  }

  /**
   * Validate a task ID
   * @param id Task ID to validate
   * @returns True if the ID is valid, false otherwise
   */
  isValidTaskId(id: string): boolean {
    // Task IDs should be non-empty strings that can be parsed as integers
    if (!id || typeof id !== 'string') {
      return false;
    }

    // Try to parse as integer
    const parsedId = parseInt(id, 10);
    return !isNaN(parsedId) && parsedId.toString() === id;
  }
}
