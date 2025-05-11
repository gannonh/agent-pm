import type { Task } from '../../types/task.d.ts';
import type { ITaskRepository } from '../interfaces/ITaskRepository.js';
import { FileSystemError, ErrorCode } from '../../types/errors.js';

/**
 * Implementation of the task repository
 */
export class TaskRepository implements ITaskRepository {
  private tasks: Map<string, Task>;

  /**
   * Create a new TaskRepository
   */
  constructor() {
    this.tasks = new Map<string, Task>();
  }

  /**
   * Get a task by ID
   * @param id Task ID
   * @returns The task, or undefined if not found
   */
  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  /**
   * Get all tasks
   * @returns Array of all tasks
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Add a task to the repository
   * @param task Task to add
   * @throws Error if a task with the same ID already exists
   */
  addTask(task: Task): void {
    if (this.tasks.has(task.id)) {
      throw new FileSystemError(`Task with ID ${task.id} already exists`, ErrorCode.ALREADY_EXISTS);
    }
    this.tasks.set(task.id, task);
  }

  /**
   * Update a task in the repository
   * @param id Task ID
   * @param task Updated task
   * @throws Error if the task does not exist
   */
  updateTask(id: string, task: Task): void {
    if (!this.tasks.has(id)) {
      throw new FileSystemError(`Task with ID ${id} not found`, ErrorCode.NOT_FOUND);
    }
    this.tasks.set(id, task);
  }

  /**
   * Delete a task from the repository
   * @param id Task ID
   * @returns True if the task was deleted, false if it didn't exist
   */
  deleteTask(id: string): boolean {
    return this.tasks.delete(id);
  }

  /**
   * Check if a task exists in the repository
   * @param id Task ID
   * @returns True if the task exists, false otherwise
   */
  hasTask(id: string): boolean {
    return this.tasks.has(id);
  }

  /**
   * Clear all tasks from the repository
   */
  clear(): void {
    this.tasks.clear();
  }
}
