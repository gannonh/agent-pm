import type { TasksData } from '../../types/task.d.ts';

/**
 * Interface for task file management operations
 */
export interface ITaskFileManager {
  /**
   * Save tasks to a file
   * @param filePath Path to the file
   * @param tasksData Tasks data to save
   * @param keepBackups Number of backup files to keep (default: 5)
   * @returns Promise that resolves when the save is complete
   */
  saveToFile(filePath: string, tasksData: TasksData, keepBackups?: number): Promise<void>;

  /**
   * Load tasks from a file
   * @param filePath Path to the file
   * @returns Promise that resolves with the loaded tasks data
   */
  loadFromFile(filePath: string): Promise<TasksData>;

  /**
   * Find the tasks file path
   * @returns Promise that resolves with the tasks file path
   */
  findTasksFilePath(): Promise<string>;

  /**
   * Check if a tasks file exists
   * @param filePath Path to the file
   * @returns Promise that resolves with true if the file exists, false otherwise
   */
  tasksFileExists(filePath: string): Promise<boolean>;
}
