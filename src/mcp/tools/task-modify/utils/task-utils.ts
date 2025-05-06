/**
 * Utility functions for task modification
 */
import { MCPValidationError } from '../../../errors/index.js';
import { Task } from '../../../types/index.js';

/**
 * Creates a new task object with the specified properties
 * @param id Task ID
 * @param title Task title
 * @param description Task description
 * @param priority Task priority
 * @param dependencies Comma-separated list of task IDs this task depends on
 * @param details Implementation details
 * @param testStrategy Test strategy
 * @returns New task object
 */
export function createNewTask(
  id: string,
  title: string,
  description: string,
  priority: string,
  dependencies?: string,
  details?: string,
  testStrategy?: string
): Task {
  return {
    id,
    title,
    description,
    status: 'pending',
    priority,
    dependencies: dependencies
      ? dependencies
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : [],
    details,
    testStrategy,
  };
}

/**
 * Gets the next available task ID
 * @param tasks Array of existing tasks
 * @returns Next available task ID
 */
export function getNextTaskId(tasks: Task[]): string {
  if (tasks.length === 0) {
    return '1';
  }

  // Find the maximum task ID
  const maxId = Math.max(
    ...tasks.map((task) => {
      const id = parseInt(task.id, 10);
      return isNaN(id) ? 0 : id;
    })
  );

  // Return the next ID
  return String(maxId + 1);
}

/**
 * Validates task dependencies
 * @param dependencyIds Array of dependency IDs
 * @param tasks Array of existing tasks
 * @throws MCPValidationError if any dependency is invalid
 */
export function validateDependencies(dependencyIds: string[], tasks: Task[]): void {
  if (dependencyIds.length === 0) {
    return;
  }

  // Check if all dependencies exist
  // Convert both IDs to strings before comparing to handle type mismatches
  const invalidDependencies = dependencyIds.filter(
    (id) => !tasks.some((task) => String(task.id) === String(id))
  );

  if (invalidDependencies.length > 0) {
    throw new MCPValidationError('Invalid dependencies', {
      dependencies: [`The following dependencies do not exist: ${invalidDependencies.join(', ')}`],
    });
  }
}

/**
 * Finds tasks that depend on the given task ID
 * @param tasks Array of tasks
 * @param taskId ID of the task to check dependencies for
 * @returns Array of tasks that depend on the given task ID
 */
export function findDependentTasks(tasks: Task[], taskId: string): Task[] {
  return tasks.filter((task) => {
    if (!task.dependencies) return false;
    return task.dependencies.some((depId) => String(depId) === String(taskId));
  });
}

/**
 * Removes references to the given task ID from all tasks' dependencies
 * @param tasks Array of tasks
 * @param taskId ID of the task to remove from dependencies
 */
export function removeDependencyReferences(tasks: Task[], taskId: string): void {
  for (const task of tasks) {
    if (task.dependencies && task.dependencies.length > 0) {
      task.dependencies = task.dependencies.filter((depId) => String(depId) !== String(taskId));
    }
  }
}
