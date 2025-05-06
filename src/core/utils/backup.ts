/**
 * @fileoverview Backup utilities for task files.
 * Provides functionality to create, list, restore, and clean up backups of task files.
 * Backups are stored with timestamps in a dedicated backup directory.
 *
 * @module core/utils/backup
 */
import path from 'path';
import { copyFile, fileExists } from './fs.js';
import { ensureDirectoryExists, getBackupDirectoryPath } from './path.js';
// AppConfig import removed as it's no longer needed
import { FileSystemError } from '../../types/errors.js';
import { ErrorCode } from '../../types/errors.js';

/**
 * Creates a backup of a specified file with a timestamp-based name.
 * The backup is stored in the project's backup directory with the format:
 * `{filename}.{timestamp}.bak`
 *
 * @param {string} filePath - Path to the file to backup
 * @param {string} [projectRoot] - Optional project root directory
 * @returns {Promise<string>} Path to the created backup file
 * @throws {FileSystemError} If the backup cannot be created or the source file doesn't exist
 *
 * @example
 * ```ts
 * const backupPath = await createBackup('tasks/task-1.md');
 * // Creates: .backup/task-1.md.2024-03-20T12-34-56.bak
 * ```
 */
export async function createBackup(filePath: string, projectRoot?: string): Promise<string> {
  try {
    // Check if the file exists
    if (!(await fileExists(filePath))) {
      throw new FileSystemError(
        `Cannot backup non-existent file: ${filePath}`,
        ErrorCode.NOT_FOUND
      );
    }

    // Get the backup directory path
    const backupDir = await getBackupDirectoryPath(projectRoot);

    // Ensure the backup directory exists
    await ensureDirectoryExists(backupDir);

    // Create a timestamp for the backup filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = path.basename(filePath);
    const backupFileName = `${fileName}.${timestamp}.bak`;
    const backupPath = path.join(backupDir, backupFileName);

    // Copy the file to the backup location
    await copyFile(filePath, backupPath);

    return backupPath;
  } catch (error) {
    if (error instanceof FileSystemError) {
      throw error;
    }

    throw new FileSystemError(
      `Error creating backup of ${filePath}: ${(error as Error).message}`,
      ErrorCode.BACKUP_ERROR,
      error
    );
  }
}

/**
 * Lists all backups for a specified file, sorted by creation time (newest first).
 * Only returns files matching the pattern `{filename}.*.bak`
 *
 * @param {string} filePath - Path to the original file
 * @param {string} [projectRoot] - Optional project root directory
 * @returns {Promise<string[]>} Array of backup file paths, sorted newest to oldest
 *
 * @example
 * ```ts
 * const backups = await listBackups('tasks/task-1.md');
 * // Returns: ['.backup/task-1.md.2024-03-20T12-34-56.bak', ...]
 * ```
 */
export async function listBackups(filePath: string, projectRoot?: string): Promise<string[]> {
  try {
    // Get the backup directory path
    const backupDir = await getBackupDirectoryPath(projectRoot);

    // Check if the backup directory exists
    if (!(await fileExists(backupDir))) {
      return [];
    }

    // Get the filename
    const fileName = path.basename(filePath);

    // List all files in the backup directory
    const fs = await import('fs/promises');
    const files = await fs.readdir(backupDir);

    // Filter for backups of this file and sort by timestamp (newest first)
    const backupFiles = files
      .filter((file) => file.startsWith(`${fileName}.`) && file.endsWith('.bak'))
      .sort()
      .reverse()
      .map((file) => path.join(backupDir, file));

    return backupFiles;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // Backup directory doesn't exist, so no backups
      return [];
    }

    throw new FileSystemError(
      `Error listing backups for ${filePath}: ${(error as Error).message}`,
      ErrorCode.DIRECTORY_READ_ERROR,
      error
    );
  }
}

/**
 * Restores a file from a specified backup.
 * Creates a backup of the current file (if it exists) before restoring.
 * If no original path is provided, attempts to infer it from the backup filename.
 *
 * @param {string} backupPath - Path to the backup file to restore from
 * @param {string} [originalPath] - Path to restore to (if not provided, inferred from backup filename)
 * @param {string} [projectRoot] - Optional project root directory
 * @throws {FileSystemError} If the backup cannot be restored or the backup file doesn't exist
 *
 * @example
 * ```ts
 * await restoreFromBackup('.backup/task-1.md.2024-03-20T12-34-56.bak');
 * // Restores to: tasks/task-1.md
 * ```
 */
export async function restoreFromBackup(
  backupPath: string,
  originalPath?: string,
  projectRoot?: string
): Promise<void> {
  try {
    // Check if the backup file exists
    if (!(await fileExists(backupPath))) {
      throw new FileSystemError(`Backup file not found: ${backupPath}`, ErrorCode.NOT_FOUND);
    }

    // If original path is not provided, infer it from the backup filename
    let targetPath = originalPath;
    if (!targetPath) {
      const backupFileName = path.basename(backupPath);
      const originalFileName = backupFileName.split('.')[0]; // Get the part before the first dot

      if (!originalFileName) {
        throw new FileSystemError(
          `Cannot infer original path from backup filename: ${backupFileName}`,
          ErrorCode.INVALID_ARGUMENT
        );
      }

      // Get the backup directory path
      const backupDir = await getBackupDirectoryPath(projectRoot);

      // Infer the original directory (parent of backup directory)
      const originalDir = path.dirname(backupDir);

      targetPath = path.join(originalDir, originalFileName);
    }

    // Create a backup of the current file if it exists
    if (await fileExists(targetPath)) {
      await createBackup(targetPath, projectRoot);
    }

    // Copy the backup to the original location
    await copyFile(backupPath, targetPath);
  } catch (error) {
    if (error instanceof FileSystemError) {
      throw error;
    }

    throw new FileSystemError(
      `Error restoring from backup ${backupPath}: ${(error as Error).message}`,
      ErrorCode.RESTORE_ERROR,
      error
    );
  }
}

/**
 * Cleans up old backups, keeping only the specified number of most recent backups.
 * Deletes excess backups starting with the oldest ones.
 *
 * @param {string} filePath - Path to the original file
 * @param {number} [keepCount=5] - Number of recent backups to keep
 * @param {string} [projectRoot] - Optional project root directory
 * @returns {Promise<number>} Number of backups deleted
 *
 * @example
 * ```ts
 * const deleted = await cleanupBackups('tasks/task-1.md', 3);
 * // Keeps 3 most recent backups, returns number of deleted backups
 * ```
 */
export async function cleanupBackups(
  filePath: string,
  keepCount = 5,
  projectRoot?: string
): Promise<number> {
  try {
    // Get all backups for this file
    const backups = await listBackups(filePath, projectRoot);

    // If we have fewer backups than the keep count, do nothing
    if (backups.length <= keepCount) {
      return 0;
    }

    // Get the backups to delete (all except the most recent 'keepCount')
    const backupsToDelete = backups.slice(keepCount);

    // Delete each backup
    const fs = await import('fs/promises');
    for (const backupPath of backupsToDelete) {
      await fs.unlink(backupPath);
    }

    return backupsToDelete.length;
  } catch (error) {
    throw new FileSystemError(
      `Error cleaning up backups for ${filePath}: ${(error as Error).message}`,
      ErrorCode.BACKUP_ERROR,
      error
    );
  }
}
