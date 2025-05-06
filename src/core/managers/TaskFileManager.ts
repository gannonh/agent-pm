import type { TasksData } from '../../types/task.d.ts';
import { ITaskFileManager } from '../interfaces/ITaskFileManager.js';
import { AppConfig } from '../../types/config.js';
import * as fs from '../utils/fs.js';
import * as path from '../utils/path.js';
import * as lock from '../utils/lock.js';
import * as backup from '../utils/backup.js';
import * as serialization from '../utils/serialization.js';
import type {
  FileSystemError as _FileSystemError,
  ErrorCode as _ErrorCode,
} from '../../types/errors.js';

/**
 * Implementation of the task file manager
 */
export class TaskFileManager implements ITaskFileManager {
  private config?: Partial<AppConfig>;
  private projectRoot?: string;

  /**
   * Create a new TaskFileManager
   * @param config Application configuration
   * @param projectRoot Project root directory
   */
  constructor(config?: Partial<AppConfig>, projectRoot?: string) {
    this.config = config;
    this.projectRoot = projectRoot;
  }

  /**
   * Save tasks to a file
   * @param filePath Path to the file
   * @param tasksData Tasks data to save
   * @param keepBackups Number of backup files to keep (default: 5)
   * @returns Promise that resolves when the save is complete
   */
  async saveToFile(filePath: string, tasksData: TasksData, keepBackups = 5): Promise<void> {
    // Create a backup of the existing file if it exists
    if (await fs.fileExists(filePath)) {
      await backup.createBackup(filePath, this.projectRoot);

      // Clean up old backups if requested
      if (keepBackups > 0) {
        await backup.cleanupBackups(filePath, keepBackups, this.projectRoot);
      }
    }

    // Validate the tasks data
    const validatedTasksData = serialization.validateTasksData(tasksData);

    // Save the tasks data to the file with a lock
    await lock.withFileLock(filePath, async () => {
      await fs.writeJsonFile(filePath, validatedTasksData);
    });
  }

  /**
   * Load tasks from a file
   * @param filePath Path to the file
   * @returns Promise that resolves with the loaded tasks data
   */
  async loadFromFile(filePath: string): Promise<TasksData> {
    // Read the file
    const tasksData = await fs.readJsonFile(filePath);

    // Validate the tasks data
    const validatedTasksData = serialization.validateTasksData(tasksData as TasksData);

    return validatedTasksData;
  }

  /**
   * Find the tasks file path
   * @returns Promise that resolves with the tasks file path
   */
  async findTasksFilePath(): Promise<string> {
    return path.findTasksJsonPath(this.projectRoot);
  }

  /**
   * Check if a tasks file exists
   * @param filePath Path to the file
   * @returns Promise that resolves with true if the file exists, false otherwise
   */
  async tasksFileExists(filePath: string): Promise<boolean> {
    return fs.fileExists(filePath);
  }
}
