import type { Task, TasksData } from '../../types/task.d.ts';

/**
 * Interface for partial tasks data that might need migration
 */
export interface PartialTasksData {
  tasks?: unknown[];
  metadata?: {
    version?: string;
    created?: string;
    updated?: string;
    projectName?: string;
    projectDescription?: string;
  };
}

/**
 * Interface for partial task data that might need migration
 */
export interface PartialTask {
  id?: string;
  title?: string;
  description?: string;
  details?: string;
  testStrategy?: string;
  status?: string;
  priority?: string;
  dependencies?: unknown[];
  subtasks?: unknown[];
}

/**
 * Interface for task migration operations
 */
export interface ITaskMigrationService {
  /**
   * Check if tasks data needs migration
   * @param tasksData Tasks data to check
   * @returns True if the tasks data needs migration, false otherwise
   */
  needsDataMigration(tasksData: unknown): boolean;

  /**
   * Migrate tasks data to the current format
   * @param tasksData Tasks data to migrate
   * @returns Migrated tasks data
   */
  migrateTasksData(tasksData: unknown): TasksData;

  /**
   * Migrate a task to the current format
   * @param task Task to migrate
   * @returns Migrated task
   */
  migrateTask(task: unknown): Task;
}
