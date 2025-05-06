import type { Task } from '../../types/task.d.ts';

/**
 * Interface for task dependency management operations
 */
export interface ITaskDependencyManager {
  /**
   * Add a dependency to a task
   * @param taskId Task ID
   * @param dependencyId Dependency ID
   * @returns The updated task
   * @throws Error if the task or dependency does not exist, or if adding the dependency would create a circular dependency
   */
  addDependency(taskId: string, dependencyId: string): Promise<Task>;

  /**
   * Remove a dependency from a task
   * @param taskId Task ID
   * @param dependencyId Dependency ID
   * @returns The updated task
   * @throws Error if the task does not exist
   */
  removeDependency(taskId: string, dependencyId: string): Promise<Task>;

  /**
   * Check if adding a dependency would create a circular dependency
   * @param taskId Task ID
   * @param dependencyId Dependency ID
   * @returns True if adding the dependency would create a circular dependency, false otherwise
   */
  hasCircularDependency(taskId: string, dependencyId: string): Promise<boolean>;

  /**
   * Find tasks that depend on a given task
   * @param taskId Task ID
   * @returns Array of tasks that depend on the given task
   */
  findDependentTasks(taskId: string): Task[];

  /**
   * Remove a task from all dependencies
   * @param taskId Task ID to remove from dependencies
   */
  removeFromAllDependencies(taskId: string): void;
}
