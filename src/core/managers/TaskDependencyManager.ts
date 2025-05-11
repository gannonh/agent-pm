import type { Task } from '../../types/task.d.ts';
import type { ITaskDependencyManager } from '../interfaces/ITaskDependencyManager.js';
import type { ITaskRepository } from '../interfaces/ITaskRepository.js';
import { FileSystemError, ErrorCode } from '../../types/errors.js';

/**
 * Implementation of the task dependency manager
 */
export class TaskDependencyManager implements ITaskDependencyManager {
  private repository: ITaskRepository;

  /**
   * Create a new TaskDependencyManager
   * @param repository Task repository
   */
  constructor(repository: ITaskRepository) {
    this.repository = repository;
  }

  /**
   * Add a dependency to a task
   * @param taskId Task ID
   * @param dependencyId Dependency ID
   * @returns The updated task
   * @throws Error if the task or dependency does not exist, or if adding the dependency would create a circular dependency
   */
  async addDependency(taskId: string, dependencyId: string): Promise<Task> {
    // Check if the task exists
    const task = this.repository.getTask(taskId);
    if (!task) {
      throw new FileSystemError(`Task with ID ${taskId} not found`, ErrorCode.NOT_FOUND);
    }

    // Check if the dependency exists
    const dependency = this.repository.getTask(dependencyId);
    if (!dependency) {
      throw new FileSystemError(
        `Dependency with ID ${dependencyId} not found`,
        ErrorCode.NOT_FOUND
      );
    }

    // Check if the dependency already exists
    if (task.dependencies.includes(dependencyId)) {
      return task;
    }

    // Check if adding the dependency would create a circular dependency
    const wouldCreateCircular = await this.hasCircularDependency(taskId, dependencyId);
    if (wouldCreateCircular) {
      throw new FileSystemError(
        'Adding this dependency would create a circular dependency',
        ErrorCode.CIRCULAR_DEPENDENCY
      );
    }

    // Add the dependency
    const updatedTask = {
      ...task,
      dependencies: [...task.dependencies, dependencyId],
    };

    // Update the task in the repository
    this.repository.updateTask(taskId, updatedTask);

    return updatedTask;
  }

  /**
   * Remove a dependency from a task
   * @param taskId Task ID
   * @param dependencyId Dependency ID
   * @returns The updated task
   * @throws Error if the task does not exist
   */
  async removeDependency(taskId: string, dependencyId: string): Promise<Task> {
    // Check if the task exists
    const task = this.repository.getTask(taskId);
    if (!task) {
      throw new FileSystemError(`Task with ID ${taskId} not found`, ErrorCode.NOT_FOUND);
    }

    // Check if the dependency exists in the task
    if (!task.dependencies.includes(dependencyId)) {
      return task;
    }

    // Remove the dependency
    const updatedTask = {
      ...task,
      dependencies: task.dependencies.filter((id) => id !== dependencyId),
    };

    // Update the task in the repository
    this.repository.updateTask(taskId, updatedTask);

    return updatedTask;
  }

  /**
   * Check if adding a dependency would create a circular dependency
   * @param taskId Task ID
   * @param dependencyId Dependency ID
   * @returns True if adding the dependency would create a circular dependency, false otherwise
   */
  async hasCircularDependency(taskId: string, dependencyId: string): Promise<boolean> {
    // If the task and dependency are the same, it's a circular dependency
    if (taskId === dependencyId) {
      return true;
    }

    // Get the dependency
    const dependency = this.repository.getTask(dependencyId);
    if (!dependency) {
      return false;
    }

    // Check if any of the dependency's dependencies would create a circular dependency
    for (const depId of dependency.dependencies) {
      // If the dependency depends on the task, it's a circular dependency
      if (depId === taskId) {
        return true;
      }

      // Recursively check if any of the dependency's dependencies would create a circular dependency
      const hasCircular = await this.hasCircularDependency(taskId, depId);
      if (hasCircular) {
        return true;
      }
    }

    return false;
  }

  /**
   * Find tasks that depend on a given task
   * @param taskId Task ID
   * @returns Array of tasks that depend on the given task
   */
  findDependentTasks(taskId: string): Task[] {
    return this.repository.getAllTasks().filter((task) => task.dependencies.includes(taskId));
  }

  /**
   * Remove a task from all dependencies
   * @param taskId Task ID to remove from dependencies
   */
  removeFromAllDependencies(taskId: string): void {
    // Find all tasks that depend on the given task
    const dependentTasks = this.findDependentTasks(taskId);

    // Remove the task from all dependencies
    for (const task of dependentTasks) {
      const updatedTask = {
        ...task,
        dependencies: task.dependencies.filter((id) => id !== taskId),
      };
      this.repository.updateTask(task.id, updatedTask);
    }
  }
}
